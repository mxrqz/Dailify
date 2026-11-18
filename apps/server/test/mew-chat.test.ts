import { describe, it, expect, vi } from "vitest";

let userId = "mw1";

vi.mock("openai", () => import("./openai"));
import { openaiMock } from "./openai";

vi.mock("../src/auth", () => import("./session"));
import { mockSession } from "./session";
mockSession(() => ({ id: userId, plan: "free" }));

import { env } from "cloudflare:test";
import { DateTime } from "luxon";
import app from "../src/index";
import { MEW_IMAGE_MAX, limitsFor, type MewBlock, type MewReply, type Task } from "@dailify/shared";
import { bumpStoredUsage, periodFor, readStoredUsage } from "../src/db/usage";
import { insertTask } from "../src/db/tasks";
import { saveSettings } from "../src/db/settings";

const TZ = "America/Sao_Paulo";

const used = (id: string) => readStoredUsage(env.DB, id, "ai", periodFor(new Date()));
const consent = (id: string) => saveSettings(env.DB, id, { mewConsent: true });

function chat(body: Record<string, unknown>) {
  return app.request(
    "/mew/chat",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "oi", timezone: TZ, history: [], ...body }),
    },
    env,
  );
}

const patch = (id: string, body: unknown) =>
  app.request(
    `/mew/actions/${id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    env,
  );

function aiReturns(output: Record<string, unknown>) {
  openaiMock.responses.create.mockResolvedValue({
    output_text: JSON.stringify({
      intent: "answer",
      reply: "ok",
      show: [],
      proposals: [],
      ...output,
    }),
  });
}

const gptTask = (over: Record<string, unknown>) => ({
  title: "Nova",
  date: null,
  duration: null,
  repeat: "Off",
  repeatEvery: null,
  links: [],
  targets: [],
  ...over,
});

const local = (days: number, hour: number, minute = 0) =>
  DateTime.now().setZone(TZ).plus({ days }).set({ hour, minute, second: 0, millisecond: 0 });

const seed = (id: string, over: Partial<Task>) =>
  insertTask(env.DB, userId, {
    id,
    title: id,
    date: local(1, 15, 30).toMillis(),
    duration: "",
    priority: 0,
    repeat: "Off",
    completed: [],
    ...over,
  });

const confirms = (blocks: MewBlock[]) => blocks.flatMap((b) => (b.kind === "confirm" ? [b] : []));

describe("POST /mew/chat", () => {
  it("sem consentimento → 403 sem chamar a OpenAI nem debitar", async () => {
    userId = "mw-noconsent";
    const res = await chat({});
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "Mew Consent Required",
      code: "mew_consent_required",
    });
    expect(openaiMock.responses.create).not.toHaveBeenCalled();
    expect(await used(userId)).toBe(0);
  });

  it("monta os blocos só com ids da agenda e respeita as travas", async () => {
    userId = "mw-blocks";
    await consent(userId);
    await seed("plain1", { alert: local(1, 15).toMillis() });
    await seed("linked1", { links: ["https://www.google.com/calendar/event?eid=x"] });
    await seed("series1", { date: local(0, 8).toMillis(), repeat: "Daily" });
    const seriesRef = `series1@${local(1, 8).toISODate()}`;
    const target = local(3, 0).toISODate();
    aiReturns({
      intent: "propose",
      reply: " Proponho isto ",
      show: ["plain1", seriesRef, "ghost"],
      proposals: [
        { action: "move", ids: ["plain1", seriesRef, "ghost"], date: target, tasks: [] },
        { action: "delete", ids: ["linked1", "plain1"], date: null, tasks: [] },
        { action: "delete", ids: [seriesRef], date: null, tasks: [] },
        {
          action: "create",
          ids: [],
          date: null,
          tasks: [gptTask({ title: "Dentista", date: `${local(2, 0).toISODate()}T10:00:00` })],
        },
      ],
    });

    const res = await chat({ text: "move pra quinta" });
    expect(res.status).toBe(200);
    const body = await res.json<MewReply>();
    expect(body.reply).toBe("Proponho isto");
    expect(body.intent).toBe("propose");

    const [shown] = body.blocks;
    // plain1 is already in the move box, so it isn't listed again.
    expect(shown.kind === "tasks" && shown.tasks.map((t) => t.id)).toEqual(["series1"]);

    const [move, del, create] = confirms(body.blocks);
    expect(confirms(body.blocks)).toHaveLength(3); // the series-only delete dropped
    expect(move).toMatchObject({ action: "move", label: target });
    expect(move.before.map((t) => t.id)).toEqual(["plain1"]);
    // Same time of day, new day; the alert shifts with it. Epoch-ms numbers.
    expect(move.after[0].date).toBe(local(3, 15, 30).toMillis());
    expect(move.after[0].alert).toBe(local(3, 15).toMillis());

    expect(del.before.map((t) => t.id)).toEqual(["plain1"]);
    expect(del.after).toEqual([]);

    expect(create.before).toEqual([]);
    expect(create.after[0]).toMatchObject({ title: "Dentista", date: local(2, 10).toMillis() });
    expect(create.after[0].id).toMatch(/^[A-Za-z0-9_-]{6,64}$/);

    expect(await used(userId)).toBe(1);
    const { results } = await env.DB.prepare(
      "SELECT id, action, task_ids, status FROM mew_actions WHERE user_id=? ORDER BY action",
    )
      .bind(userId)
      .all();
    expect(results).toHaveLength(3);
    expect(results.find((r) => r.id === move.id)).toMatchObject({
      action: "move",
      task_ids: '["plain1"]',
      status: "proposed",
    });
  });

  it("manda a agenda no prompt, o histórico e a imagem; nada de store", async () => {
    userId = "mw-prompt";
    await consent(userId);
    await seed("seen1", { title: "Pagar | luz" });
    aiReturns({});
    const image = "data:image/jpeg;base64,AAAA";
    await chat({ image, history: [{ from: "mew", text: "Oi!" }] });
    const sent = openaiMock.responses.create.mock.calls[0][0];
    expect(sent).toMatchObject({ model: "gpt-6-luna", store: false });
    // Titles are untrusted: the agenda is user-role data, never part of `instructions`.
    expect(sent.instructions).not.toContain("seen1");
    expect(sent.input[0]).toMatchObject({ role: "user" });
    expect(sent.input[0].content).toContain(
      `seen1|Pagar   luz|${local(1, 15, 30).toFormat("yyyy-MM-dd'T'HH:mm")}|aberta|-|-`,
    );
    expect(sent.input[1]).toEqual({ role: "assistant", content: "Oi!" });
    expect(sent.input[2].content[1]).toMatchObject({ type: "input_image", image_url: image });
  });

  it("proposta que não sobrou nada vira notFound", async () => {
    userId = "mw-nf";
    await consent(userId);
    aiReturns({
      intent: "propose",
      proposals: [{ action: "delete", ids: ["ghost"], date: null, tasks: [] }],
    });
    const body = await (await chat({})).json<MewReply>();
    expect(body).toMatchObject({ intent: "notFound", blocks: [] });
  });

  it("falha ou resposta fora do contrato → 502 sem débito", async () => {
    userId = "mw-502";
    await consent(userId);
    openaiMock.responses.create.mockRejectedValue(new Error("timeout"));
    expect((await chat({})).status).toBe(502);
    aiReturns({ intent: "talk" });
    expect((await chat({})).status).toBe(502);
    aiReturns({
      intent: "propose",
      proposals: [{ action: "move", ids: [], date: "sexta", tasks: [] }],
    });
    expect((await chat({})).status).toBe(502);
    expect(await used(userId)).toBe(0);
  });

  it("créditos esgotados → 429 sem chamar a OpenAI", async () => {
    userId = "mw-429";
    await consent(userId);
    for (let i = 0; i < limitsFor("free").ai; i++)
      await bumpStoredUsage(env.DB, userId, "ai", periodFor(new Date()));
    const res = await chat({});
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "AI Credits Limit Reached", code: "ai_exhausted" });
    expect(openaiMock.responses.create).not.toHaveBeenCalled();
  });

  it("valida o corpo antes de chamar a OpenAI", async () => {
    userId = "mw-400";
    await consent(userId);
    expect((await chat({ text: "" })).status).toBe(400);
    expect((await chat({ text: "x".repeat(501) })).status).toBe(400);
    expect((await chat({ timezone: "Mars/Olympus" })).status).toBe(400);
    expect((await chat({ history: Array(9).fill({ from: "me", text: "a" }) })).status).toBe(400);
    expect((await chat({ history: [{ from: "bot", text: "a" }] })).status).toBe(400);
    expect((await chat({ image: "https://x/y.png" })).status).toBe(400);
    userId = "mw-413"; // AI_LIMITER allows 6 a minute per user
    await consent(userId);
    const big = `data:image/jpeg;base64,${"A".repeat(MEW_IMAGE_MAX)}`;
    expect((await chat({ image: big })).status).toBe(413);
    expect(openaiMock.responses.create).not.toHaveBeenCalled();
  });
});

describe("PATCH /mew/actions/:id", () => {
  it("só o dono muda o status", async () => {
    userId = "mw-owner";
    await consent(userId);
    aiReturns({
      intent: "propose",
      proposals: [{ action: "create", ids: [], date: null, tasks: [gptTask({})] }],
    });
    const [block] = confirms((await (await chat({})).json<MewReply>()).blocks);

    expect((await patch(block.id, { status: "nope" })).status).toBe(400);
    userId = "mw-intruder";
    expect((await patch(block.id, { status: "done" })).status).toBe(404);
    userId = "mw-owner";
    expect((await patch(block.id, { status: "done" })).status).toBe(204);
    const row = await env.DB.prepare("SELECT status FROM mew_actions WHERE id=?")
      .bind(block.id)
      .first<{ status: string }>();
    expect(row?.status).toBe("done");
  });
});
