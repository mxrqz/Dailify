import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";

let userId = "eu1";
let role = "free";
vi.mock("@clerk/hono", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/hono")>();
  return { ...actual, getAuth: vi.fn(() => ({ userId })) };
});
vi.mock("../src/lib/clerk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/clerk")>();
  return { ...actual, getUserRole: vi.fn(async () => role) };
});

import { env, applyD1Migrations } from "cloudflare:test";
import {
  INTEGRATIONS,
  zonedEpoch,
  type ExternalEvent,
  type IntegrationLink,
  type Task,
} from "@dailify/shared";
import app from "../src/index";
import { sealTokens, loadCtx } from "../src/integrations/connection";
import { createEvent } from "../src/integrations/google-calendar";
import { eventId, toEvent } from "../src/integrations/google-calendar/event";
import { getConnection, getLink, upsertConnection } from "../src/db/integrations";
import { getTask, insertTask } from "../src/db/tasks";
import * as google from "./fixtures/google-calendar";

const TZ = "America/Sao_Paulo";
const at = (month: number, day: number, hour: number, minute = 0) =>
  zonedEpoch({ year: 2026, month, day, hour, minute, second: 0 }, TZ);
const task = (over: Partial<Task> = {}): Task => ({
  id: "task01",
  title: "Reunião",
  date: at(10, 16, 15),
  duration: "1h30m",
  priority: 0,
  repeat: "Off",
  completed: [],
  ...over,
});

describe("toEvent", () => {
  it("com horário: dateTime de parede no fuso, fim pela duração, id e taskId", () => {
    const e = toEvent(task({ links: ["https://x.com/doc"] }), TZ, { meet: false });
    expect(e).toMatchObject({
      id: eventId("task01"),
      summary: "Reunião",
      description: "Criado pela Mewki\nhttps://x.com/doc",
      start: { dateTime: "2026-11-16T15:00:00", timeZone: TZ },
      end: { dateTime: "2026-11-16T16:30:00", timeZone: TZ },
      extendedProperties: { private: { mewkiTaskId: "task01" } },
    });
    expect(e?.recurrence).toBeUndefined();
    expect(e?.conferenceData).toBeUndefined();
  });

  it("Sem data com lembrete = dia inteiro no dia do lembrete; sem lembrete = null", () => {
    const e = toEvent(task({ undated: true, alert: at(10, 30, 9) }), TZ, { meet: false });
    expect(e?.start).toEqual({ date: "2026-11-30" });
    expect(e?.end).toEqual({ date: "2026-12-01" });
    expect(toEvent(task({ undated: true }), TZ, { meet: false })).toBeNull();
  });

  it("semanal a cada 2 com BYDAY ordenado e WKST no dia da tarefa (quarta)", () => {
    const e = toEvent(
      task({ date: at(10, 18, 9), repeat: { Weekly: ["Friday", "Monday"] }, repeatEvery: 2 }),
      TZ,
      { meet: false },
    );
    expect(e?.recurrence).toEqual(["RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,FR;WKST=WE"]);
  });

  it("diário, mensal e anual; dia 31 e 29/fev cortam pro último dia", () => {
    const rule = (over: Partial<Task>) => toEvent(task(over), TZ, { meet: false })?.recurrence;
    expect(rule({ repeat: "Daily", repeatEvery: 3 })).toEqual(["RRULE:FREQ=DAILY;INTERVAL=3"]);
    expect(rule({ repeat: "Monthly" })).toEqual(["RRULE:FREQ=MONTHLY"]);
    expect(rule({ repeat: "Monthly", date: at(0, 31, 9) })).toEqual([
      "RRULE:FREQ=MONTHLY;BYMONTHDAY=28,29,30,31;BYSETPOS=-1",
    ]);
    expect(rule({ repeat: "Yearly" })).toEqual(["RRULE:FREQ=YEARLY"]);
    const leap = zonedEpoch({ year: 2028, month: 1, day: 29, hour: 9, minute: 0, second: 0 }, TZ);
    expect(rule({ repeat: "Yearly", date: leap })).toEqual([
      "RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=28,29;BYSETPOS=-1",
    ]);
  });

  it("exdates viram EXDATE com TZID (horário) ou VALUE=DATE (dia inteiro)", () => {
    const timed = toEvent(
      task({ repeat: "Daily", exdates: [at(10, 17, 15), at(10, 19, 15)] }),
      TZ,
      { meet: false },
    );
    expect(timed?.recurrence?.[1]).toBe(`EXDATE;TZID=${TZ}:20261117T150000,20261119T150000`);
    const allDay = toEvent(
      task({ undated: true, alert: at(10, 16, 9), repeat: "Daily", exdates: [at(10, 17, 9)] }),
      TZ,
      { meet: false },
    );
    expect(allDay?.recurrence?.[1]).toBe("EXDATE;VALUE=DATE:20261117");
  });

  it("Meet: pede sala só sem link de vídeo; com Zoom ele vira o local", () => {
    expect(toEvent(task(), TZ, { meet: true })?.conferenceData).toEqual({
      createRequest: {
        requestId: eventId("task01"),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    });
    const zoom = toEvent(task({ links: ["https://us02web.zoom.us/j/1"] }), TZ, { meet: true });
    expect(zoom?.location).toBe("https://us02web.zoom.us/j/1");
    expect(zoom?.conferenceData).toBeUndefined();
  });

  it("id do evento: base32hex válido pro Google, determinístico", () => {
    expect(eventId("foobar")).toBe("cpnmuoj1e8");
    for (const id of ["abcdef", "A_b-9Z", "x".repeat(64)]) {
      const e = eventId(id);
      expect(e).toMatch(/^[a-v0-9]{5,1024}$/);
      expect(eventId(id)).toBe(e);
    }
    expect(eventId("abcdef")).not.toBe(eventId("abcdeg"));
  });
});

const ORIGIN = "https://mewki.mxrqz.com";
let routes: Record<string, (init?: RequestInit) => Response>;
let calls: { url: string; method: string; body: string }[];
// A PK de `tasks` é global: id fixo entre usuários de teste colidiria.
let tid: string;

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(() => {
  userId = `eu-${crypto.randomUUID()}`;
  role = "free";
  tid = `t${crypto.randomUUID().slice(0, 8)}`;
  calls = [];
  routes = {
    [google.EVENTS]: () => Response.json(google.event),
    "https://oauth2.googleapis.com/token": () => Response.json(google.refreshed),
  };
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({ url, method: init?.method ?? "GET", body: String(init?.body ?? "") });
    const route = routes[url.split("?")[0]];
    if (!route) throw new Error(`fetch não mockado: ${url}`);
    return route(init);
  });
});

afterEach(() => vi.restoreAllMocks());

async function seed(over: { expiresAt?: number; links?: string[] } = {}) {
  const tokens = await sealTokens(env, userId, "google-calendar", {
    accessToken: "ya29.ok",
    refreshToken: "1//refresh-1",
    scope: google.token.scope,
    expiresAt: over.expiresAt ?? Date.now() + 3600_000,
  });
  await upsertConnection(
    env.DB,
    userId,
    "google-calendar",
    { accountId: "1098765", email: "pessoa@gmail.com", scopes: google.token.scope, tokens },
    Date.now(),
  );
  await insertTask(env.DB, userId, task({ id: tid, links: over.links }));
}

const post = (body: unknown) =>
  app.request(
    "/integrations/google-calendar/events",
    {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify(body),
    },
    env,
  );
const input = () => ({ taskId: tid, timezone: TZ, meet: true });

describe("POST /integrations/google-calendar/events", () => {
  it("caminho feliz: cria com Meet, grava o vínculo e põe os links na tarefa", async () => {
    await seed({ links: ["https://x.com/doc"] });
    const res = await post(input());
    expect(res.status).toBe(200);
    const body = await res.json<{ link: IntegrationLink; task: Task }>();

    const insert = calls.find((c) => c.url.startsWith(google.EVENTS));
    expect(insert?.url).toBe(`${google.EVENTS}?conferenceDataVersion=1`);
    expect(JSON.parse(insert?.body ?? "{}")).toMatchObject({
      id: eventId(tid),
      conferenceData: { createRequest: { conferenceSolutionKey: { type: "hangoutsMeet" } } },
    });
    expect(body.link).toEqual({
      provider: "google-calendar",
      taskId: tid,
      externalId: eventId(tid),
      url: google.event.htmlLink,
    });
    expect(body.task.links).toEqual([
      "https://x.com/doc",
      google.event.htmlLink,
      google.event.hangoutLink,
    ]);
    expect((await getTask(env.DB, userId, tid))?.links).toEqual(body.task.links);
    expect(await getLink(env.DB, userId, "google-calendar", tid)).toEqual(body.link);
  });

  it("já vinculada -> 409 com o vínculo, sem chamar o Google", async () => {
    await seed();
    expect((await post(input())).status).toBe(200);
    calls = [];
    const res = await post(input());
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      code: "already_linked",
      link: { externalId: eventId(tid) },
    });
    expect(calls).toHaveLength(0);
  });

  it("409 do Google (id já existe) vira PATCH e segue", async () => {
    await seed();
    routes[google.EVENTS] = () => Response.json(google.eventExists, { status: 409 });
    routes[`${google.EVENTS}/${eventId(tid)}`] = () => Response.json(google.event);
    const res = await post({ ...input(), meet: false });
    expect(res.status).toBe(200);
    const patch = calls.find((c) => c.method === "PATCH");
    expect(JSON.parse(patch?.body ?? "{}")).toMatchObject({ status: "confirmed" });
    expect(await getLink(env.DB, userId, "google-calendar", tid)).not.toBeNull();
  });

  it("sem conexão -> 409 reconnect", async () => {
    await insertTask(env.DB, userId, task({ id: tid }));
    const res = await post(input());
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "reconnect" });
  });

  it("refresh recusado -> marca revogada e 409 reconnect", async () => {
    await seed({ expiresAt: Date.now() - 1 });
    routes["https://oauth2.googleapis.com/token"] = () =>
      Response.json(google.invalidGrant, { status: 400 });
    const res = await post(input());
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "reconnect" });
    expect((await getConnection(env.DB, userId, "google-calendar"))?.status).toBe("revoked");
  });

  it("fora do plano -> 403", async () => {
    await seed();
    const roles = INTEGRATIONS["google-calendar"].roles;
    INTEGRATIONS["google-calendar"].roles = ["max"];
    try {
      expect((await post(input())).status).toBe(403);
    } finally {
      INTEGRATIONS["google-calendar"].roles = roles;
    }
  });

  it("Google 429 -> 502 com recado e nada gravado", async () => {
    await seed();
    routes[google.EVENTS] = () => Response.json(google.rateLimited, { status: 429 });
    const res = await post(input());
    expect(res.status).toBe(502);
    expect((await res.json<{ error: string }>()).error).toMatch(/minutos/);
    expect(await getLink(env.DB, userId, "google-calendar", tid)).toBeNull();
  });

  it("body inválido, tarefa de outro e Sem data sem dia", async () => {
    await seed();
    expect((await post({ ...input(), timezone: "Marte/Base" })).status).toBe(400);
    expect((await post({ ...input(), taskId: "nope00" })).status).toBe(404);
    await insertTask(env.DB, userId, task({ id: `u${tid}`, undated: true }));
    expect((await post({ ...input(), taskId: `u${tid}` })).status).toBe(400);
  });

  it("preview da action é o texto da confirmação", async () => {
    await seed();
    const ctx = await loadCtx(env, userId, "google-calendar");
    if (!ctx) throw new Error("sem ctx");
    const text = await createEvent.preview(ctx, { taskId: tid, timeZone: TZ, meet: true });
    expect(text).toMatch(/^Criar evento no Google Agenda · .* 15:00–16:30 · com Meet$/);
  });
});

const list = (q: string) =>
  app.request(`/integrations/google-calendar/events?${q}`, { headers: { origin: ORIGIN } }, env);
const from = at(10, 1, 0);
const window = (over: Record<string, string | number> = {}) =>
  new URLSearchParams(
    Object.entries({ from, to: at(11, 1, 0), tz: TZ, ...over }).map(([k, v]) => [k, String(v)]),
  ).toString();

describe("GET /integrations/google-calendar/events", () => {
  it("pagina, abre séries, lê dia inteiro no fuso e marca os da Mewki", async () => {
    await seed();
    routes[google.EVENTS] = () =>
      Response.json(
        calls.filter((c) => c.url.startsWith(google.EVENTS)).length === 1
          ? google.listPage1
          : google.listPage2,
      );
    const res = await list(window());
    expect(res.status).toBe(200);
    const { events } = await res.json<{ events: ExternalEvent[] }>();

    const gets = calls.filter((c) => c.url.startsWith(google.EVENTS)).map((c) => new URL(c.url));
    expect(gets).toHaveLength(2);
    expect(Object.fromEntries(gets[0].searchParams)).toMatchObject({
      singleEvents: "true",
      orderBy: "startTime",
      showDeleted: "false",
      timeMin: new Date(from).toISOString(),
    });
    expect(gets[1].searchParams.get("pageToken")).toBe("page-2");

    expect(events).toEqual([
      {
        id: "ev1",
        title: "Dentista",
        start: at(10, 16, 10),
        end: at(10, 16, 11),
        allDay: false,
        url: "https://www.google.com/calendar/event?eid=ev1",
        meet: "https://meet.google.com/abc-defg-hij",
      },
      {
        id: "ev2",
        title: "Feriado",
        start: at(10, 20, 0),
        end: at(10, 21, 0),
        allDay: true,
        url: "https://www.google.com/calendar/event?eid=ev2",
      },
      expect.objectContaining({ id: "daily_20261117T120000Z", recurring: true }),
      expect.objectContaining({ id: "mewki1", mewkiTaskId: "task01" }),
    ]);
    expect(await getLink(env.DB, userId, "google-calendar", "ev1")).toBeNull();
  });

  it("dia inteiro segue o fuso pedido", async () => {
    await seed();
    routes[google.EVENTS] = () => Response.json({ items: [google.listPage1.items[1]] });
    const res = await list(window({ tz: "Asia/Tokyo" }));
    const { events } = await res.json<{ events: ExternalEvent[] }>();
    expect(events[0].start).toBe(
      zonedEpoch({ year: 2026, month: 10, day: 20, hour: 0, minute: 0, second: 0 }, "Asia/Tokyo"),
    );
  });

  it("janela maior que 62 dias é cortada; janela ou fuso inválidos -> 400", async () => {
    await seed();
    routes[google.EVENTS] = () => Response.json({ items: [] });
    expect((await list(window({ to: from + 400 * 86_400_000 }))).status).toBe(200);
    const max = new URL(calls[0].url).searchParams.get("timeMax");
    expect(max).toBe(new Date(from + 62 * 86_400_000).toISOString());
    expect((await list(window({ to: from }))).status).toBe(400);
    expect((await list(window({ from: "x" }))).status).toBe(400);
    expect((await list(window({ tz: "Marte/Base" }))).status).toBe(400);
  });

  it("sem conexão ou refresh recusado -> 409 reconnect; Google fora -> 502", async () => {
    expect((await list(window())).status).toBe(409);
    await seed({ expiresAt: Date.now() - 1 });
    routes["https://oauth2.googleapis.com/token"] = () =>
      Response.json(google.invalidGrant, { status: 400 });
    const revoked = await list(window());
    expect(revoked.status).toBe(409);
    expect(await revoked.json()).toMatchObject({ code: "reconnect" });

    userId = `eu-${crypto.randomUUID()}`;
    await seed();
    routes[google.EVENTS] = () => new Response("boom", { status: 500 });
    expect((await list(window())).status).toBe(502);
  });

  it("fora do plano -> 403", async () => {
    await seed();
    const roles = INTEGRATIONS["google-calendar"].roles;
    INTEGRATIONS["google-calendar"].roles = ["max"];
    try {
      expect((await list(window())).status).toBe(403);
    } finally {
      INTEGRATIONS["google-calendar"].roles = roles;
    }
  });
});

const link = (body: unknown) =>
  app.request(
    "/integrations/google-calendar/links",
    {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify(body),
    },
    env,
  );

describe("POST /integrations/google-calendar/links", () => {
  const EV = `${google.EVENTS}/ev1`;
  const linkInput = () => ({ taskId: tid, eventId: "ev1", timezone: TZ });

  it("vincula sem criar evento: marca o mewkiTaskId, grava o vínculo e põe os links", async () => {
    await seed({ links: ["https://x.com/doc"] });
    routes[EV] = () => Response.json(google.existing);
    const res = await link(linkInput());
    expect(res.status).toBe(200);
    const body = await res.json<{ link: IntegrationLink; task: Task }>();

    expect(calls.some((c) => c.method === "POST")).toBe(false);
    const patch = calls.find((c) => c.method === "PATCH");
    expect(patch?.url).toBe(EV);
    // Só a marca: título, horário e descrição do evento ficam como estão até a próxima edição.
    expect(JSON.parse(patch?.body ?? "{}")).toEqual({
      extendedProperties: { private: { mewkiTaskId: tid } },
    });
    expect(body.link).toEqual({
      provider: "google-calendar",
      taskId: tid,
      externalId: "ev1",
      url: google.existing.htmlLink,
    });
    expect(body.task.links).toEqual([
      "https://x.com/doc",
      google.existing.htmlLink,
      google.existing.hangoutLink,
    ]);
    expect(await getLink(env.DB, userId, "google-calendar", tid)).toEqual(body.link);
  });

  it("409 se a tarefa ou o evento já têm vínculo, sem PATCH", async () => {
    await seed();
    routes[EV] = () => Response.json(google.existing);
    expect((await link(linkInput())).status).toBe(200);

    calls = [];
    const again = await link(linkInput());
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ code: "already_linked" });

    await insertTask(env.DB, userId, task({ id: `o${tid}` }));
    const other = await link({ ...linkInput(), taskId: `o${tid}` });
    expect(other.status).toBe(409);
    expect(calls).toHaveLength(0);

    // Marcado no Google por outra tarefa (vínculo perdido no D1) também é 409.
    routes[EV] = () =>
      Response.json({ ...google.existing, extendedProperties: { private: { mewkiTaskId: "z" } } });
    await insertTask(env.DB, userId, task({ id: `p${tid}` }));
    await env.DB.prepare("DELETE FROM integration_links WHERE user_id=?").bind(userId).run();
    expect((await link({ ...linkInput(), taskId: `p${tid}` })).status).toBe(409);
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
  });

  it("evento sumido -> 404; recorrente -> 400; body inválido -> 400", async () => {
    await seed();
    routes[EV] = () => Response.json({ error: { code: 404 } }, { status: 404 });
    expect((await link(linkInput())).status).toBe(404);
    routes[EV] = () => Response.json({ ...google.existing, recurringEventId: "s" });
    expect((await link(linkInput())).status).toBe(400);
    expect((await link({ ...linkInput(), eventId: "" })).status).toBe(400);
    expect((await link({ ...linkInput(), timezone: "x" })).status).toBe(400);
    expect(await getLink(env.DB, userId, "google-calendar", tid)).toBeNull();
  });
});
