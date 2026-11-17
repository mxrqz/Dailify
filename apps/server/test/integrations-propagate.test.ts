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

const UPDATED = "2026-11-16T15:00:00.123Z";

let tid: string;
let calls: { url: string; method: string; body: string }[];
let google404 = false;
let googleStatus = 200;
let googleBody: Record<string, unknown> = {};

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(() => {
  userId = `eu-${crypto.randomUUID()}`;
  tid = `t${crypto.randomUUID().slice(0, 8)}`;
  calls = [];
  google404 = false;
  googleStatus = 200;
  googleBody = {};
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, method: init?.method ?? "GET", body: String(init?.body ?? "") });
    if (url === "https://oauth2.googleapis.com/token")
      return Response.json(google.invalidGrant, { status: 400 });
    if (!url.startsWith(`${google.EVENTS}/`)) throw new Error(`fetch não mockado: ${url}`);
    if (google404) return Response.json({}, { status: 404 });
    if (googleStatus !== 200) return Response.json({}, { status: googleStatus });
    return init?.method === "DELETE"
      ? new Response(null, { status: 204 })
      : Response.json({ updated: UPDATED, ...googleBody });
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

async function seed(
  over: Partial<Task> = {},
  opts: { linked?: boolean; expired?: boolean; external?: string; readonly?: boolean } = {},
) {
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
      {
        provider: "google-calendar",
        taskId: tid,
        externalId: opts.external ?? eventId(tid),
        url: HTML,
      },
      TZ,
      Date.now(),
      { readonly: opts.readonly },
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
const bodyOf = (i = 0) => JSON.parse(googleCalls()[i].body);
const remoteUpdated = async (taskId = tid) =>
  (
    await env.DB.prepare(
      `SELECT remote_updated FROM integration_links WHERE user_id=? AND task_id=?`,
    )
      .bind(userId, taskId)
      .first<{ remote_updated: number | null }>()
  )?.remote_updated;

describe("propagação de tarefa vinculada", () => {
  it("evento criado pela Mewki: PATCH só com o que mudou, e o `updated` vira remote_updated", async () => {
    await seed();
    const res = await patch({ title: "Dentista", date: at(17, 14), duration: "1h" });
    expect(res.status).toBe(200);
    const [call] = googleCalls();
    expect(call.method).toBe("PATCH");
    expect(call.url).toBe(`${google.EVENTS}/${eventId(tid)}`);
    expect(JSON.parse(call.body)).toEqual({
      summary: "Dentista",
      start: { date: null, dateTime: "2026-11-17T14:00:00", timeZone: TZ },
      end: { date: null, dateTime: "2026-11-17T15:00:00", timeZone: TZ },
    });
    expect((await link()).stale).toBe(false);
    expect(await remoteUpdated()).toBe(Date.parse(UPDATED));

    calls = [];
    await patch({ links: [HTML, "https://x.com/doc"] });
    expect(bodyOf()).toEqual({ description: "Criado pela Mewki\nhttps://x.com/doc" });
  });

  it("evento vinculado (não criado pela Mewki): nunca description/location/extendedProperties", async () => {
    await seed({}, { external: "ev1" });
    await patch({ title: "Dentista", links: [HTML, "https://x.com/doc"] });
    expect(googleCalls()[0].url).toBe(`${google.EVENTS}/ev1`);
    expect(bodyOf()).toEqual({ summary: "Dentista" });

    // Só link mudou: nada que seja nosso mudou no evento, nem chama o Google.
    calls = [];
    await patch({ links: [HTML, "https://x.com/doc"] });
    expect(googleCalls()).toHaveLength(0);
  });

  it("convite readonly: a edição fica na Mewki, nenhum PATCH", async () => {
    await seed({}, { external: "ev1", readonly: true });
    expect((await patch({ title: "Outro", date: at(17, 9) })).status).toBe(200);
    expect(googleCalls()).toHaveLength(0);
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

  it("excluir só esta ocorrência: a série ganha o EXDATE", async () => {
    await seed({ repeat: "Daily" });
    const res = await remove(`?occurrence=${at(18, 10)}`);
    expect(res.status).toBe(200);
    const [call] = googleCalls();
    expect(call.method).toBe("PATCH");
    expect(JSON.parse(call.body)).toEqual({
      recurrence: ["RRULE:FREQ=DAILY", `EXDATE;TZID=${TZ}:20261118T100000`],
    });
  });

  it("editar só esta: a solta vira a instância no Google (PATCH dela), sem EXDATE na série", async () => {
    await seed({ repeat: "Daily" }, { external: "ser1" });
    const res = await patch({ title: "Só hoje", date: at(19, 11) }, `?occurrence=${at(19, 10)}`);
    expect(res.status).toBe(200);
    const { task } = await res.json<{ task: Task }>();

    // 10:00 em São Paulo = 13:00Z: o id da instância é o início original em UTC.
    const instance = "ser1_20261119T130000Z";
    expect(googleCalls().map((c) => [c.method, c.url])).toEqual([
      ["PATCH", `${google.EVENTS}/${instance}`],
    ]);
    expect(bodyOf()).toEqual({
      summary: "Só hoje",
      start: { date: null, dateTime: "2026-11-19T11:00:00", timeZone: TZ },
      end: { date: null, dateTime: "2026-11-19T11:30:00", timeZone: TZ },
    });
    expect(await listTaskLinks(env.DB, userId, task.id)).toEqual([
      expect.objectContaining({ externalId: instance, timeZone: TZ, readonly: false }),
    ]);
    expect(await remoteUpdated(task.id)).toBe(Date.parse(UPDATED));

    // Excluir outro dia: o EXDATE da série leva só ele, a instância vinculada fica de fora.
    calls = [];
    await remove(`?occurrence=${at(20, 10)}`);
    expect(bodyOf().recurrence).toEqual(["RRULE:FREQ=DAILY", `EXDATE;TZID=${TZ}:20261120T100000`]);

    // Editar a solta depois PATCHa a instância de novo.
    calls = [];
    await send(`/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ title: "Mudou" }) });
    expect(googleCalls()[0].url).toBe(`${google.EVENTS}/${instance}`);
    expect(bodyOf()).toEqual({ summary: "Mudou" });
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
    // Reenvio de evento criado pela Mewki: o corpo todo.
    expect(bodyOf()).toMatchObject({
      summary: "Novo",
      description: "Criado pela Mewki",
      extendedProperties: { private: { mewkiTaskId: tid } },
    });
    expect((await link()).stale).toBe(false);
  });

  it("reenvio de evento vinculado: só título, horário e regra", async () => {
    await seed({}, { external: "ev1" });
    const res = await send(`/integrations/google-calendar/events/${tid}/sync`, {
      method: "POST",
      body: JSON.stringify({ timezone: TZ }),
    });
    expect(res.status).toBe(200);
    expect(Object.keys(bodyOf()).sort()).toEqual(["end", "recurrence", "start", "summary"]);
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

const MEET = "https://meet.google.com/abc-defg-hij";
const OTHER = "https://meet.google.com/xyz-wxyz-xyz";
const room = (code: string) => ({
  conferenceId: code,
  conferenceSolution: { key: { type: "hangoutsMeet" } },
  entryPoints: [{ entryPointType: "video", uri: `https://meet.google.com/${code}` }],
});

describe("Meet de tarefa vinculada", () => {
  it("evento vinculado: trocar e tirar o Meet manda só o conferenceData, com version=1", async () => {
    await seed({ links: [HTML, MEET] }, { external: "ev1" });
    await patch({ links: [HTML, OTHER] });
    expect(googleCalls()[0].url).toBe(`${google.EVENTS}/ev1?conferenceDataVersion=1`);
    expect(bodyOf()).toEqual({ conferenceData: room("xyz-wxyz-xyz") });
    expect(await remoteUpdated()).toBe(Date.parse(UPDATED));

    calls = [];
    await patch({ links: [HTML] });
    expect(bodyOf()).toEqual({ conferenceData: null });
  });

  it("evento criado pela Mewki: a sala troca junto com a descrição e o local", async () => {
    await seed({ links: [HTML, MEET] });
    await patch({ links: [HTML, OTHER] });
    expect(googleCalls()[0].url).toBe(`${google.EVENTS}/${eventId(tid)}?conferenceDataVersion=1`);
    expect(bodyOf()).toEqual({
      description: `Criado pela Mewki\n${OTHER}`,
      location: OTHER,
      conferenceData: room("xyz-wxyz-xyz"),
    });

    calls = [];
    await patch({ links: [HTML] });
    expect(bodyOf()).toEqual({
      description: "Criado pela Mewki",
      location: null,
      conferenceData: null,
    });
  });

  it("reenvio não regrava a sala (tiraria os telefones de discagem)", async () => {
    await seed({ links: [HTML, MEET] }, { external: "ev1" });
    await send(`/integrations/google-calendar/events/${tid}/sync`, {
      method: "POST",
      body: JSON.stringify({ timezone: TZ }),
    });
    expect(googleCalls()[0].url).toBe(`${google.EVENTS}/ev1`);
    expect(bodyOf()).not.toHaveProperty("conferenceData");
  });

  const newMeet = () =>
    send(`/integrations/google-calendar/events/${tid}/meet`, { method: "POST" });

  for (const [kind, external] of [
    ["criado", undefined],
    ["vinculado", "ev1"],
  ] as const)
    it(`gerar novo Meet (evento ${kind}): createRequest, e o Meet antigo sai dos links`, async () => {
      await seed({ links: [HTML, "https://x.com/doc", MEET] }, { external });
      googleBody = { hangoutLink: OTHER };
      const res = await newMeet();
      expect(res.status).toBe(200);
      const [call] = googleCalls();
      expect([call.method, call.url]).toEqual([
        "PATCH",
        `${google.EVENTS}/${external ?? eventId(tid)}?conferenceDataVersion=1`,
      ]);
      const body = bodyOf();
      expect(Object.keys(body)).toEqual(["conferenceData"]);
      expect(body.conferenceData.createRequest).toMatchObject({
        requestId: expect.any(String),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      });
      const { task } = await res.json<{ task: Task }>();
      expect(task.links).toEqual([HTML, "https://x.com/doc", OTHER]);
      expect((await getTask(env.DB, userId, tid))?.links).toEqual(task.links);
      // O eco do PATCH: o sync reconhece e não desfaz a troca.
      expect(await remoteUpdated()).toBe(Date.parse(UPDATED));
    });

  it("gerar novo Meet: convite readonly e tarefa fora da Agenda recusam sem chamar o Google", async () => {
    await seed({}, { external: "ev1", readonly: true });
    expect((await newMeet()).status).toBe(400);
    tid = `t${crypto.randomUUID().slice(0, 8)}`;
    await seed({}, { linked: false });
    expect((await newMeet()).status).toBe(404);
    expect(googleCalls()).toHaveLength(0);
  });
});
