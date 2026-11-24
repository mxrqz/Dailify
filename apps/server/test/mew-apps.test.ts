import { beforeEach, describe, expect, it, vi } from "vitest";

// A fake reader/sender on the calendar, so the route is tested apart from Slack's HTTP.
const fake = vi.hoisted(() => ({
  read: vi.fn<
    (env: unknown, userId: string, target: string) => Promise<{ text: string; card?: MewCard }>
  >(),
  send: vi.fn<(env: unknown, userId: string, target: string, text: string) => Promise<void>>(),
}));
vi.mock("../src/integrations/registry", async (importOriginal) => {
  const { PROVIDERS } = await importOriginal<typeof import("../src/integrations/registry")>();
  return {
    PROVIDERS: {
      ...PROVIDERS,
      "google-calendar": {
        ...PROVIDERS["google-calendar"],
        target: "channel id",
        read: fake.read,
        send: fake.send,
      },
    },
  };
});

vi.mock("openai", () => import("./openai"));
import { openaiMock } from "./openai";

vi.mock("../src/auth", () => import("./session"));
import { mockSession } from "./session";
let userId = "";
mockSession(() => ({ id: userId, plan: "free" }));

import { env } from "cloudflare:workers";
import type { IntegrationStatus, MewBlock, MewCard, MewReply } from "@dailify/shared";
import app from "../src/index";
import { upsertConnection } from "../src/db/integrations";
import { saveSettings } from "../src/db/settings";
import { periodFor, readStoredUsage } from "../src/db/usage";

const TZ = "America/Sao_Paulo";
const P = "google-calendar";

const used = () => readStoredUsage(env.DB, userId, "ai", periodFor(new Date()));
const req = (path: string, method: string, body?: unknown) =>
  app.request(
    path,
    {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    env,
  );
const chat = (extra: Record<string, unknown> = {}) =>
  req("/mew/chat", "POST", { text: "respondi o João?", timezone: TZ, history: [], ...extra });

function aiReturns(...outputs: Record<string, unknown>[]) {
  for (const output of outputs)
    openaiMock.responses.create.mockResolvedValueOnce({
      output_text: JSON.stringify({
        intent: "answer",
        reply: "ok",
        show: [],
        proposals: [],
        read: null,
        send: null,
        ...output,
      }),
    });
}
const asksToRead = {
  reply: "Posso ler o #geral?",
  read: { provider: P, target: "C1", label: "#geral" },
};
const answered = { reply: "Não respondeu ainda." };

const permissionOf = (blocks: MewBlock[]) => {
  const b = blocks.find((x) => x.kind === "permission");
  if (!b) throw new Error("no permission block");
  return b;
};
const statusOf = async (id: string) =>
  (
    await env.DB.prepare("SELECT status FROM mew_actions WHERE id=?")
      .bind(id)
      .first<{ status: string }>()
  )?.status;
const grants = async () =>
  (await env.DB.prepare("SELECT provider FROM mew_grants WHERE user_id=?").bind(userId).all())
    .results;

beforeEach(async () => {
  userId = `apps-${crypto.randomUUID()}`;
  await saveSettings(env.DB, userId, { mewConsent: true });
  await upsertConnection(
    env.DB,
    userId,
    P,
    { accountId: "acc", email: null, scopes: "", tokens: "sealed" },
    Date.now(),
  );
  fake.read.mockResolvedValue({ text: "João: pode revisar o PR?" });
  fake.send.mockResolvedValue();
});

describe("POST /mew/chat — reading an app", () => {
  it("without a grant answers a permission box, reads nothing and logs the stored target", async () => {
    aiReturns(asksToRead);
    const res = await chat();
    expect(res.status).toBe(200);
    const block = permissionOf((await res.json<MewReply>()).blocks);
    expect(block).toMatchObject({ provider: P, capability: "read", target: "C1", label: "#geral" });
    expect(fake.read).not.toHaveBeenCalled();
    expect(await used()).toBe(1);
    const row = await env.DB.prepare("SELECT action, provider, target FROM mew_actions WHERE id=?")
      .bind(block.id)
      .first();
    expect(row).toEqual({ action: "read", provider: P, target: "C1" });
    // Offered only because the provider reads: the schema and prompt name it.
    const sent = openaiMock.responses.create.mock.calls[0][0];
    expect(sent.text.format.schema.required).toContain("read");
    expect(sent.instructions).toContain("channel id");
  });

  it("allow once reads, answers with the content as user data, stores no grant, no extra credit", async () => {
    aiReturns(asksToRead, answered);
    const { id } = permissionOf((await (await chat()).json<MewReply>()).blocks);
    const res = await chat({ permission: { id, always: false } });
    expect(res.status).toBe(200);
    expect(await res.json<MewReply>()).toMatchObject({ reply: answered.reply, blocks: [] });
    expect(fake.read).toHaveBeenCalledWith(expect.anything(), userId, "C1");

    const second = openaiMock.responses.create.mock.calls[1][0];
    expect(second.instructions).not.toContain("pode revisar");
    expect(second.input.at(-1)).toMatchObject({ role: "user" });
    expect(second.input.at(-1).content).toContain("João: pode revisar o PR?");
    // No asking again inside the same turn.
    expect(second.text.format.schema.required).not.toContain("read");

    expect(await grants()).toEqual([]);
    expect(await statusOf(id)).toBe("done");
    expect(await used()).toBe(1);
    // Single use: a replay gets nothing.
    expect((await chat({ permission: { id, always: false } })).status).toBe(404);
  });

  it("always stores the grant, the next ask reads without a box, and the revoke switch drops it", async () => {
    aiReturns(asksToRead, answered);
    const { id } = permissionOf((await (await chat()).json<MewReply>()).blocks);
    await chat({ permission: { id, always: true } });
    expect(await grants()).toEqual([{ provider: P }]);

    aiReturns(asksToRead, answered);
    const body = await (await chat()).json<MewReply>();
    expect(body.blocks.some((b) => b.kind === "permission")).toBe(false);
    expect(body.reply).toBe(answered.reply);
    expect(fake.read).toHaveBeenCalledTimes(2);
    expect(await used()).toBe(2);

    const list = async () =>
      (await (await req("/integrations", "GET")).json<IntegrationStatus[]>()).find(
        (s) => s.provider === P,
      );
    expect((await list())?.readAlways).toBe(true);
    expect((await req(`/integrations/${P}/grants/read`, "DELETE")).status).toBe(204);
    expect((await list())?.readAlways).toBeUndefined();
  });

  it("deny cancels the action, so a later allow for it is a 404", async () => {
    aiReturns(asksToRead);
    const { id } = permissionOf((await (await chat()).json<MewReply>()).blocks);
    expect((await req(`/mew/actions/${id}`, "PATCH", { status: "cancelled" })).status).toBe(204);
    expect((await chat({ permission: { id, always: true } })).status).toBe(404);
    expect(fake.read).not.toHaveBeenCalled();
    expect(await grants()).toEqual([]);
  });

  it("a foreign or unknown permission id is a 404 and calls nothing", async () => {
    aiReturns(asksToRead);
    const { id } = permissionOf((await (await chat()).json<MewReply>()).blocks);
    const owner = userId;
    userId = `apps-${crypto.randomUUID()}`;
    await saveSettings(env.DB, userId, { mewConsent: true });
    expect((await chat({ permission: { id, always: true } })).status).toBe(404);
    expect((await chat({ permission: { id: "ghost", always: false } })).status).toBe(404);
    expect((await chat({ permission: { id, always: "yes" } })).status).toBe(400);
    expect(openaiMock.responses.create).toHaveBeenCalledTimes(1);
    userId = owner;
    expect(await statusOf(id)).toBe("proposed");
  });

  it("a read's card is appended as an items block the model never sees", async () => {
    const card: MewCard = {
      provider: P,
      source: "#geral",
      url: "https://x.slack.com/archives/C1",
      total: 1,
      items: [{ title: "pode revisar o PR?", url: "https://x.slack.com/p1", icon: "message" }],
    };
    fake.read.mockResolvedValue({ text: "João: pode revisar o PR?", card });
    aiReturns(asksToRead, answered);
    const { id } = permissionOf((await (await chat()).json<MewReply>()).blocks);
    const body = await (await chat({ permission: { id, always: true } })).json<MewReply>();
    expect(body.blocks).toEqual([{ kind: "items", ...card }]);
    expect(JSON.stringify(openaiMock.responses.create.mock.calls[1][0])).not.toContain(card.url);

    // The "always" path appends it too.
    aiReturns(asksToRead, answered);
    expect((await (await chat()).json<MewReply>()).blocks).toEqual([{ kind: "items", ...card }]);
  });

  it("a failed read puts the action back to proposed, so allowing again works", async () => {
    aiReturns(asksToRead, answered);
    const { id } = permissionOf((await (await chat()).json<MewReply>()).blocks);
    fake.read.mockRejectedValueOnce(new Error("slack down"));
    expect((await chat({ permission: { id, always: false } })).status).toBe(502);
    expect(await statusOf(id)).toBe("proposed");
    expect((await chat({ permission: { id, always: false } })).status).toBe(200);
  });

  it("disconnecting the provider deletes its grants", async () => {
    aiReturns(asksToRead, answered);
    const { id } = permissionOf((await (await chat()).json<MewReply>()).blocks);
    await chat({ permission: { id, always: true } });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    expect((await req(`/integrations/${P}`, "DELETE")).status).toBe(204);
    expect(await grants()).toEqual([]);
  });
});

describe("POST /mew/actions/:id/send", () => {
  const draft = {
    reply: "Rascunho pronto.",
    send: { provider: P, target: "C1", to: "#geral", text: "Já revisei!" },
  };
  const sendBlock = (blocks: MewBlock[]) => {
    const b = blocks.find((x) => x.kind === "send");
    if (!b) throw new Error("no send block");
    return b;
  };

  it("sends the confirmed (edited) text to the stored target once", async () => {
    aiReturns(draft);
    const block = sendBlock((await (await chat()).json<MewReply>()).blocks);
    expect(block).toMatchObject({ provider: P, to: "#geral", text: "Já revisei!" });
    expect(fake.send).not.toHaveBeenCalled();

    expect((await req(`/mew/actions/${block.id}/send`, "POST", { text: " " })).status).toBe(400);
    const res = await req(`/mew/actions/${block.id}/send`, "POST", { text: "Revisado ✅" });
    expect(res.status).toBe(204);
    expect(fake.send).toHaveBeenCalledWith(expect.anything(), userId, "C1", "Revisado ✅");
    expect(await statusOf(block.id)).toBe("done");
    expect((await req(`/mew/actions/${block.id}/send`, "POST", { text: "de novo" })).status).toBe(
      404,
    );
    expect(fake.send).toHaveBeenCalledTimes(1);
  });

  it("another user's draft is a 404 and sends nothing", async () => {
    aiReturns(draft);
    const block = sendBlock((await (await chat()).json<MewReply>()).blocks);
    userId = `apps-${crypto.randomUUID()}`;
    expect((await req(`/mew/actions/${block.id}/send`, "POST", { text: "oi" })).status).toBe(404);
    expect(fake.send).not.toHaveBeenCalled();
  });

  it("a draft for an app that isn't offered never becomes a box", async () => {
    aiReturns({ send: { ...draft.send, provider: "slack" } });
    const body = await (await chat()).json<MewReply>();
    expect(body.blocks).toEqual([]);
  });
});
