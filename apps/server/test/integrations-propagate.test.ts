import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";

let userId = "eu1";
vi.mock("@clerk/hono", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/hono")>();
  return { ...actual, getAuth: vi.fn(() => ({ userId })) };
});
vi.mock("../src/lib/clerk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/clerk")>();
  return { ...actual, getUserRole: vi.fn(async () => "free" as const) };
});

import {
  env,
  applyD1Migrations,
  createExecutionContext,
  waitOnExecutionContext,
} from "cloudflare:test";
import { zonedEpoch, type IntegrationStatus, type Task } from "@dailify/shared";
import app from "../src/index";
import { sealTokens } from "../src/integrations/connection";
import { eventId } from "../src/integrations/google-calendar/event";
import { getConnection, listTaskLinks, upsertConnection, upsertLink } from "../src/db/integrations";
import { getTask, insertTask } from "../src/db/tasks";
import * as google from "./fixtures/google-calendar";

const TZ = "America/Sao_Paulo";
const at = (day: number, hour: number) =>
  zonedEpoch({ year: 2026, month: 10, day, hour, minute: 0, second: 0 }, TZ);
const HTML = google.event.htmlLink;

let tid: string;
let calls: { url: string; method: string; body: string }[];
let google404 = false;
let googleStatus = 200;

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(() => {
  userId = `eu-${crypto.randomUUID()}`;
  tid = `t${crypto.randomUUID().slice(0, 8)}`;
  calls = [];
  google404 = false;
  googleStatus = 200;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, method: init?.method ?? "GET", body: String(init?.body ?? "") });
    if (url === "https://oauth2.googleapis.com/token")
      return Response.json(google.invalidGrant, { status: 400 });
    if (!url.startsWith(`${google.EVENTS}/`)) throw new Error(`fetch não mockado: ${url}`);
    if (google404) return Response.json({}, { status: 404 });
    if (googleStatus !== 200) return Response.json({}, { status: googleStatus });
    return init?.method === "DELETE" ? new Response(null, { status: 204 }) : Response.json({});
  });
});

afterEach(() => vi.restoreAllMocks());

const base = (over: Partial<Task> = {}): Task => ({
  id: tid,
  title: "Reunião",
  date: at(16, 10),
  duration: "30m",
  priority: 0,
  repeat: "Off",
  completed: [],
  links: [HTML],
  ...over,
});

async function seed(over: Partial<Task> = {}, opts: { linked?: boolean; expired?: boolean } = {}) {
  const tokens = await sealTokens(env, userId, "google-calendar", {
    accessToken: "ya29.ok",
    refreshToken: "1//refresh-1",
    scope: google.token.scope,
    expiresAt: opts.expired ? Date.now() - 1 : Date.now() + 3600_000,
  });
  await upsertConnection(
    env.DB,
    userId,
    "google-calendar",
    { accountId: "1098765", email: "pessoa@gmail.com", scopes: google.token.scope, tokens },
    Date.now(),
  );
  await insertTask(env.DB, userId, base(over));
  if (opts.linked !== false)
    await upsertLink(
      env.DB,
      userId,
      { provider: "google-calendar", taskId: tid, externalId: eventId(tid), url: HTML },
      TZ,
      Date.now(),
    );
}

/** A rota com ExecutionContext de verdade: espera o `waitUntil` antes de olhar o Google. */
async function send(path: string, init: RequestInit) {
  const ctx = createExecutionContext();
  const res = await app.request(
    path,
    { ...init, headers: { "content-type": "application/json" } },
    env,
    ctx,
  );
  await waitOnExecutionContext(ctx);
  return res;
}
const patch = (body: unknown, query = "") =>
  send(`/tasks/${tid}${query}`, { method: "PATCH", body: JSON.stringify(body) });
const remove = (query = "") => send(`/tasks/${tid}${query}`, { method: "DELETE" });
const link = async () => (await listTaskLinks(env.DB, userId, tid))[0];
const googleCalls = () => calls.filter((c) => c.url.startsWith(google.EVENTS));

describe("propagação de tarefa vinculada", () => {
  it("PATCH muda o evento: events.patch com o evento remontado", async () => {
    await seed();
    const res = await patch({ title: "Dentista", date: at(17, 14), duration: "1h" });
    expect(res.status).toBe(200);
    const [call] = googleCalls();
    expect(call.method).toBe("PATCH");
    expect(call.url).toBe(`${google.EVENTS}/${eventId(tid)}`);
    expect(JSON.parse(call.body)).toMatchObject({
      summary: "Dentista",
      start: { date: null, dateTime: "2026-11-17T14:00:00", timeZone: TZ },
      end: { dateTime: "2026-11-17T15:00:00" },
      recurrence: null,
    });
    expect((await link()).stale).toBe(false);
  });

  it("campo que não vai pro evento (prioridade) não chama o Google", async () => {
    await seed();
    expect((await patch({ priority: 3 })).status).toBe(200);
    expect(googleCalls()).toHaveLength(0);
  });

  it("tarefa sem vínculo não chama o Google", async () => {
    await seed({}, { linked: false });
    expect((await patch({ title: "Outro" })).status).toBe(200);
    expect((await remove()).status).toBe(204);
    expect(calls).toHaveLength(0);
  });

  it("apagar: events.delete e o vínculo sai; 404 do Google também tira o vínculo", async () => {
    await seed();
    expect((await remove()).status).toBe(204);
    expect(googleCalls().map((c) => c.method)).toEqual(["DELETE"]);
    expect(await link()).toBeUndefined();

    tid = `t${crypto.randomUUID().slice(0, 8)}`;
    await seed();
    google404 = true;
    await remove();
    expect(await link()).toBeUndefined();
  });

  it("só esta ocorrência: a série ganha o EXDATE", async () => {
    await seed({ repeat: "Daily" });
    const res = await remove(`?occurrence=${at(18, 10)}`);
    expect(res.status).toBe(200);
    const [call] = googleCalls();
    expect(call.method).toBe("PATCH");
    expect(JSON.parse(call.body).recurrence).toEqual([
      "RRULE:FREQ=DAILY",
      `EXDATE;TZID=${TZ}:20261118T100000`,
    ]);

    calls = [];
    await patch({ title: "Só hoje" }, `?occurrence=${at(19, 10)}`);
    expect(JSON.parse(googleCalls()[0].body).recurrence[1]).toBe(
      `EXDATE;TZID=${TZ}:20261118T100000,20261119T100000`,
    );
  });

  it("Sem data sem lembrete: o evento sai, o vínculo e o endereço também", async () => {
    await seed({ links: [HTML, "https://x.com/doc"] });
    await patch({ undated: true, alert: null });
    expect(googleCalls().map((c) => c.method)).toEqual(["DELETE"]);
    expect(await link()).toBeUndefined();
    expect((await getTask(env.DB, userId, tid))?.links).toEqual(["https://x.com/doc"]);
  });

  it("invalid_grant: conexão revogada, e a tarefa grava", async () => {
    await seed({}, { expired: true });
    const res = await patch({ title: "Novo" });
    expect(res.status).toBe(200);
    expect((await getTask(env.DB, userId, tid))?.title).toBe("Novo");
    expect((await getConnection(env.DB, userId, "google-calendar"))?.status).toBe("revoked");
  });

  it("Google 500: a tarefa grava e o vínculo fica stale; o sync reenvia e limpa", async () => {
    await seed();
    googleStatus = 500;
    expect((await patch({ title: "Novo" })).status).toBe(200);
    expect((await getTask(env.DB, userId, tid))?.title).toBe("Novo");
    expect((await link()).stale).toBe(true);

    const status = await app.request("/integrations", {}, env);
    const [gcal] = await status.json<IntegrationStatus[]>();
    expect(gcal.stale).toEqual([tid]);

    const sync = () =>
      send(`/integrations/google-calendar/events/${tid}/sync`, {
        method: "POST",
        body: JSON.stringify({ timezone: TZ }),
      });
    expect((await sync()).status).toBe(502);
    googleStatus = 200;
    calls = [];
    const res = await sync();
    expect(res.status).toBe(200);
    expect(JSON.parse(googleCalls()[0].body).summary).toBe("Novo");
    expect((await link()).stale).toBe(false);
  });

  it("sync grava o fuso do aparelho no vínculo que não tinha", async () => {
    await seed();
    await env.DB.prepare(`UPDATE integration_links SET time_zone=NULL WHERE task_id=?`)
      .bind(tid)
      .run();
    await patch({ title: "Novo" });
    expect((await link()).stale).toBe(true);
    const res = await send(`/integrations/google-calendar/events/${tid}/sync`, {
      method: "POST",
      body: JSON.stringify({ timezone: TZ }),
    });
    expect(res.status).toBe(200);
    expect(await link()).toMatchObject({ stale: false, timeZone: TZ });
  });
});
