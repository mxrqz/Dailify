import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("openai", () => import("./openai"));
import { openaiMock } from "./openai";

vi.mock("../src/auth", () => import("./session"));
import { mockSession } from "./session";
let userId = "";
mockSession(() => ({ id: userId, plan: "free" }));

import { env } from "cloudflare:workers";
import { zonedEpoch, type MewReply, type Task } from "@dailify/shared";
import app from "../src/index";
import { SEARCH_DAYS_MAX, SEARCH_MAX, insertTask, likePattern, searchTasks } from "../src/db/tasks";
import { saveSettings } from "../src/db/settings";
import { periodFor, readStoredUsage } from "../src/db/usage";

const TZ = "America/Sao_Paulo";
const DAY = 86_400_000;

const used = () => readStoredUsage(env.DB, userId, "ai", periodFor(new Date()));
const chat = () =>
  app.request(
    "/mew/chat",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "quando fui ao dentista?", timezone: TZ, history: [] }),
    },
    env,
  );

function aiReturns(...outputs: Record<string, unknown>[]) {
  for (const output of outputs)
    openaiMock.responses.create.mockResolvedValueOnce({
      output_text: JSON.stringify({
        intent: "answer",
        reply: "ok",
        show: [],
        proposals: [],
        search: null,
        ...output,
      }),
    });
}

/** Epoch-ms of 2025-`month`-`day` `hour`:00 in `TZ` (month 1-based). */
const at = (month: number, day: number, hour = 10) =>
  zonedEpoch({ year: 2025, month: month - 1, day, hour, minute: 0, second: 0, ms: 0 }, TZ);

const seed = (id: string, over: Partial<Task>) =>
  insertTask(env.DB, userId, {
    id,
    title: id,
    date: at(3, 10),
    duration: "",
    priority: 0,
    repeat: "Off",
    completed: [],
    ...over,
  });

beforeEach(async () => {
  userId = `search-${crypto.randomUUID()}`;
  await saveSettings(env.DB, userId, { mewConsent: true });
});

describe("POST /mew/chat — search", () => {
  it("runs the model's search, answers from the second call and debits one credit", async () => {
    await seed("dent-old", { title: "Dentista", date: at(3, 10), completed: [at(3, 10)] });
    await seed("other", { title: "Mercado", date: at(3, 11) });
    aiReturns(
      { search: { query: "dentista", from: "2025-01-01", to: "2025-12-31" } },
      { reply: "Foi em 10 de março.", show: ["dent-old"] },
    );
    const res = await chat();
    expect(res.status).toBe(200);
    const body = await res.json<MewReply>();
    expect(body.reply).toBe("Foi em 10 de março.");
    expect(body.blocks).toEqual([
      { kind: "tasks", tasks: [expect.objectContaining({ id: "dent-old" })] },
    ]);
    expect(await used()).toBe(1);

    const [first, second] = openaiMock.responses.create.mock.calls.map((c) => c[0]);
    expect(first.text.format.schema.required).toContain("search");
    // No loop: the second call can't search (or read) again.
    expect(second.text.format.schema.required).not.toContain("search");
    expect(second.text.format.schema.properties).not.toHaveProperty("search");
    const found = second.input.at(-1);
    expect(found.role).toBe("user");
    expect(found.content).toContain("[Busca");
    expect(found.content).toContain("dent-old|Dentista|2025-03-10T10:00|feita");
    expect(found.content).not.toContain("Mercado");
    expect(second.instructions).not.toContain("Dentista");
  });

  it("lets the second call propose a move on a found task", async () => {
    await seed("dent-far", { title: "Dentista", date: at(9, 1) });
    aiReturns(
      { search: { query: "dentista", from: null, to: null } },
      {
        intent: "propose",
        proposals: [{ action: "move", ids: ["dent-far"], date: "2025-09-03", tasks: [] }],
      },
    );
    const body = await (await chat()).json<MewReply>();
    const box = body.blocks.find((b) => b.kind === "confirm");
    expect(box).toMatchObject({
      action: "move",
      before: [{ id: "dent-far" }],
      label: "2025-09-03",
    });
  });

  it("sends an empty result when nothing matches", async () => {
    aiReturns({ search: { query: "dentista", from: null, to: null } }, { reply: "Não achei." });
    const body = await (await chat()).json<MewReply>();
    expect(body.reply).toBe("Não achei.");
    expect(openaiMock.responses.create.mock.calls[1][0].input.at(-1).content).toContain("(vazia)");
    expect(await used()).toBe(1);
  });

  it("makes one call when she doesn't search", async () => {
    aiReturns({ reply: "Nada fora da agenda." });
    expect((await (await chat()).json<MewReply>()).reply).toBe("Nada fora da agenda.");
    expect(openaiMock.responses.create).toHaveBeenCalledTimes(1);
  });
});

describe("db/tasks searchTasks", () => {
  it("finds a series by its occurrences in the range, not its anchor", async () => {
    await seed("gym", { title: "Academia", date: at(1, 6), repeat: { Weekly: ["Monday"] } });
    const found = await searchTasks(
      env.DB,
      userId,
      { query: "academia", from: at(3, 1, 0), to: at(3, 15, 0) },
      TZ,
    );
    expect(found.length).toBe(2);
    expect(
      found.every((t) => t.id === "gym" && t.date >= at(3, 1, 0) && t.date < at(3, 15, 0)),
    ).toBe(true);
  });

  it("matches tags, case-insensitively, and only this user's rows", async () => {
    await seed("t1", { title: "Consulta", tags: ["Saude"] });
    const mine = await searchTasks(env.DB, userId, { query: "SAUDE", from: null, to: null }, TZ);
    expect(mine.map((t) => t.id)).toEqual(["t1"]);
    expect(
      await searchTasks(env.DB, "someone-else", { query: "saude", from: null, to: null }, TZ),
    ).toEqual([]);
  });

  it("caps the range at SEARCH_DAYS_MAX days and the results at SEARCH_MAX", async () => {
    await seed("daily", { title: "Remédio", date: at(1, 1), repeat: "Daily" });
    const from = at(1, 1, 0);
    const found = await searchTasks(
      env.DB,
      userId,
      { query: null, from, to: from + 1000 * DAY },
      TZ,
    );
    expect(found.length).toBe(SEARCH_MAX);
    expect(Math.max(...found.map((t) => t.date))).toBeLessThan(from + SEARCH_DAYS_MAX * DAY);
    expect(await searchTasks(env.DB, userId, { query: null, from: null, to: null }, TZ)).toEqual(
      [],
    );
  });

  it("escapes LIKE wildcards and fits D1's 50-byte pattern cap", async () => {
    await seed("pct", { title: "Desconto 50% off" });
    await seed("plain", { title: "Desconto 50 reais" });
    const ids = async (query: string) =>
      (await searchTasks(env.DB, userId, { query, from: null, to: null }, TZ)).map((t) => t.id);
    expect(await ids("50%")).toEqual(["pct"]);
    expect(await ids("_")).toEqual([]);
    expect(likePattern("a_b%c\\")).toBe("%a\\_b\\%c\\\\%");
    expect(new TextEncoder().encode(likePattern("ção".repeat(30))).length).toBeLessThanOrEqual(50);
  });
});
