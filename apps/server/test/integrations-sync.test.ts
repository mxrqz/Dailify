import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";

// O matcher real chega na Fase 1B; aqui basta o título igual pra provar que o `duplicate_of` grava.
vi.mock("@dailify/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dailify/shared")>();
  return {
    ...actual,
    matchDuplicate: (imported: { title: string }, own: { id: string; title: string }[]) =>
      own.find((t) => t.title === imported.title),
  };
});

import { env, applyD1Migrations } from "cloudflare:test";
import { zonedEpoch, type Task } from "@dailify/shared";
import { sealTokens } from "../src/integrations/connection";
import { eventId } from "../src/integrations/google-calendar/event";
import { syncCalendar, syncOldest } from "../src/integrations/google-calendar/sync";
import { upsertConnection, upsertLink } from "../src/db/integrations";
import { getTask, insertTask } from "../src/db/tasks";
import * as google from "./fixtures/google-calendar";

const TZ = "America/Sao_Paulo";
const HOUR = 3_600_000;
const NOW = Date.now();
// Depois de amanhã às 10:00 em São Paulo (UTC-3, sem horário de verão).
const day = new Date(NOW + 2 * 24 * HOUR);
const AT = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 13);
const iso = (ms: number) => new Date(ms).toISOString();
const compact = (ms: number) => iso(ms).replace(/[-:]|\.\d+/g, "");

let userId: string;
let lists: URLSearchParams[];
let respond: (q: URLSearchParams) => Response;

const page = (items: unknown[], extra: object = { nextSyncToken: "tok-1" }) =>
  Response.json({ kind: "calendar#events", items, ...extra });

const ev = (id: string, over: object = {}) => ({
  id,
  status: "confirmed",
  updated: iso(NOW - HOUR),
  summary: "Psico",
  htmlLink: `https://www.google.com/calendar/event?eid=${id}`,
  start: { dateTime: iso(AT), timeZone: TZ },
  end: { dateTime: iso(AT + HOUR), timeZone: TZ },
  organizer: { self: true },
  ...over,
});

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

beforeEach(async () => {
  userId = `eu-${crypto.randomUUID()}`;
  lists = [];
  respond = () => page([]);
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!url.startsWith(`${google.EVENTS}?`)) throw new Error(`fetch não mockado: ${url}`);
    const q = new URL(url).searchParams;
    lists.push(q);
    return respond(q);
  });
  const tokens = await sealTokens(env, userId, "google-calendar", {
    accessToken: "ya29.ok",
    refreshToken: "1//refresh-1",
    scope: google.token.scope,
    expiresAt: Date.now() + HOUR,
  });
  await upsertConnection(
    env.DB,
    userId,
    "google-calendar",
    { accountId: "1098765", email: "pessoa@gmail.com", scopes: google.token.scope, tokens },
    Date.now(),
  );
});

afterEach(() => vi.restoreAllMocks());

/** Libera o throttle: cada chamada aqui é uma passada nova. */
async function sync(full = false) {
  await env.DB.prepare(`UPDATE integration_connections SET synced_at=NULL WHERE user_id=?`)
    .bind(userId)
    .run();
  return syncCalendar(env, userId, { full });
}

const conn = () =>
  env.DB.prepare(
    `SELECT sync_token, skipped, synced_at FROM integration_connections WHERE user_id=?`,
  )
    .bind(userId)
    .first<{ sync_token: string | null; skipped: number; synced_at: number | null }>();

interface LinkRow {
  task_id: string;
  external_id: string;
  imported: number;
  remote_updated: number | null;
  readonly: number;
  duplicate_of: string | null;
  stale: number;
}
const links = async () =>
  (
    await env.DB.prepare(`SELECT * FROM integration_links WHERE user_id=? ORDER BY external_id`)
      .bind(userId)
      .all<LinkRow>()
  ).results;
const linkOf = async (externalId: string) =>
  (await links()).find((l) => l.external_id === externalId);
const taskOf = async (externalId: string) => {
  const l = await linkOf(externalId);
  return l ? getTask(env.DB, userId, l.task_id) : null;
};
const taskCount = async () =>
  (
    await env.DB.prepare(`SELECT COUNT(*) AS n FROM tasks WHERE user_id=?`)
      .bind(userId)
      .first<{ n: number }>()
  )?.n;

const own = (over: Partial<Task> = {}): Task => ({
  id: `t${crypto.randomUUID().slice(0, 8)}`,
  title: "Minha",
  date: AT,
  duration: "1h",
  priority: 2,
  repeat: "Off",
  completed: [],
  ...over,
});

describe("syncCalendar", () => {
  it("full: importa o evento e guarda o token; a lista pede séries inteiras e apagados", async () => {
    respond = () => page([ev("ev1", { hangoutLink: "https://meet.google.com/abc-defg-hij" })]);
    expect(await sync()).toEqual({ imported: 1 });

    const [q] = lists;
    expect(q.get("singleEvents")).toBe("false");
    expect(q.get("showDeleted")).toBe("true");
    expect(Number(new Date(q.get("timeMin") ?? ""))).toBeLessThan(NOW - 29 * 24 * HOUR);
    expect(q.get("syncToken")).toBeNull();

    const task = await taskOf("ev1");
    expect(task).toMatchObject({
      title: "Psico",
      date: AT,
      duration: "1h",
      repeat: "Off",
      priority: 0,
      links: [
        "https://www.google.com/calendar/event?eid=ev1",
        "https://meet.google.com/abc-defg-hij",
      ],
    });
    expect(await linkOf("ev1")).toMatchObject({
      imported: 1,
      readonly: 0,
      remote_updated: NOW - HOUR,
      duplicate_of: null,
    });
    expect((await conn())?.sync_token).toBe("tok-1");
  });

  it("incremental: só o syncToken, sem timeMin; o evento novo entra", async () => {
    respond = () => page([ev("ev1")]);
    await sync();
    respond = () => page([ev("ev2", { summary: "Dentista" })], { nextSyncToken: "tok-2" });
    expect(await sync()).toEqual({ imported: 1 });
    const q = lists[1];
    expect(q.get("syncToken")).toBe("tok-1");
    expect(q.get("timeMin")).toBeNull();
    expect((await taskOf("ev2"))?.title).toBe("Dentista");
    expect((await conn())?.sync_token).toBe("tok-2");
  });

  it("410 no incremental: volta pro full e troca o token", async () => {
    respond = () => page([ev("ev1")]);
    await sync();
    respond = (q) =>
      q.get("syncToken")
        ? Response.json({ error: { code: 410 } }, { status: 410 })
        : page([ev("ev1")], { nextSyncToken: "tok-novo" });
    await sync();
    expect(lists.slice(1).map((q) => q.has("timeMin"))).toEqual([false, true]);
    expect((await conn())?.sync_token).toBe("tok-novo");
    expect(await taskCount()).toBe(1);
  });

  it("full com timeMin sem nextSyncToken: relê sem timeMin e o corte de 30 dias vale no import", async () => {
    const old = ev("velho", {
      start: { dateTime: iso(NOW - 60 * 24 * HOUR), timeZone: TZ },
      end: { dateTime: iso(NOW - 60 * 24 * HOUR + HOUR), timeZone: TZ },
    });
    respond = (q) => (q.has("timeMin") ? page([ev("ev1")], {}) : page([old, ev("ev1")]));
    expect(await sync()).toEqual({ imported: 1 });
    expect(lists.map((q) => q.has("timeMin"))).toEqual([true, false]);
    expect(await linkOf("velho")).toBeUndefined();
    expect((await conn())?.sync_token).toBe("tok-1");
  });

  it("páginas: segue o nextPageToken e o token só vem da última", async () => {
    respond = (q) =>
      q.get("pageToken") ? page([ev("ev2")]) : page([ev("ev1")], { nextPageToken: "p2" });
    expect(await sync()).toEqual({ imported: 2 });
    expect(lists[1].get("pageToken")).toBe("p2");
    expect((await conn())?.sync_token).toBe("tok-1");
  });

  it("re-rodar o full é idempotente", async () => {
    respond = () => page([ev("ev1"), ev("ev2")]);
    await sync(true);
    expect(await sync(true)).toEqual({ imported: 0 });
    expect(await taskCount()).toBe(2);
    expect(await links()).toHaveLength(2);
  });

  it("cancelado importado: tarefa e vínculo saem", async () => {
    respond = () => page([ev("ev1")]);
    await sync();
    respond = () => page([{ id: "ev1", status: "cancelled" }]);
    await sync();
    expect(await links()).toHaveLength(0);
    expect(await taskCount()).toBe(0);
  });

  it("cancelado criado pela Mewki: só desvincula e tira o endereço", async () => {
    const task = own({
      links: ["https://www.google.com/calendar/event?eid=m", "https://x.com/doc"],
    });
    await insertTask(env.DB, userId, task);
    const id = eventId(task.id);
    const url = "https://www.google.com/calendar/event?eid=m";
    await upsertLink(
      env.DB,
      userId,
      { provider: "google-calendar", taskId: task.id, externalId: id, url },
      TZ,
      NOW,
    );
    respond = () => page([{ id, status: "cancelled" }]);
    await sync();
    expect(await links()).toHaveLength(0);
    expect((await getTask(env.DB, userId, task.id))?.links).toEqual(["https://x.com/doc"]);
  });

  it("série: ocorrência mexida vira tarefa solta e sai da série; a cancelada vira exdate", async () => {
    const moved = AT + 24 * HOUR;
    const cancelled = AT + 2 * 24 * HOUR;
    // A exceção vem antes da mestra: o sync ordena.
    respond = () =>
      page([
        ev(`serie_${compact(moved)}`, {
          recurringEventId: "serie",
          originalStartTime: { dateTime: iso(moved), timeZone: TZ },
          summary: "Psico (remarcada)",
          start: { dateTime: iso(moved + 2 * HOUR), timeZone: TZ },
          end: { dateTime: iso(moved + 3 * HOUR), timeZone: TZ },
        }),
        ev("serie", { recurrence: ["RRULE:FREQ=DAILY"] }),
      ]);
    expect(await sync()).toEqual({ imported: 2 });
    const master = await taskOf("serie");
    expect(master).toMatchObject({ repeat: "Daily", exdates: [moved] });
    const detached = await taskOf(`serie_${compact(moved)}`);
    expect(detached).toMatchObject({
      title: "Psico (remarcada)",
      repeat: "Off",
      date: moved + 2 * HOUR,
    });
    expect((await linkOf(`serie_${compact(moved)}`))?.imported).toBe(1);

    respond = () =>
      page([
        {
          id: `serie_${compact(cancelled)}`,
          status: "cancelled",
          recurringEventId: "serie",
          originalStartTime: { dateTime: iso(cancelled), timeZone: TZ },
        },
        {
          id: `serie_${compact(moved)}`,
          status: "cancelled",
          recurringEventId: "serie",
          originalStartTime: { dateTime: iso(moved), timeZone: TZ },
        },
      ]);
    await sync();
    expect((await taskOf("serie"))?.exdates).toEqual([moved, cancelled]);
    expect(await getTask(env.DB, userId, detached?.id ?? "")).toBeNull();
    expect(await taskCount()).toBe(1);
  });

  it("série cancelada leva junto as ocorrências soltas", async () => {
    const moved = AT + 24 * HOUR;
    respond = () =>
      page([
        ev("serie", { recurrence: ["RRULE:FREQ=DAILY"] }),
        ev(`serie_${compact(moved)}`, {
          recurringEventId: "serie",
          originalStartTime: { dateTime: iso(moved), timeZone: TZ },
        }),
      ]);
    await sync();
    respond = () => page([{ id: "serie", status: "cancelled" }]);
    await sync();
    expect(await taskCount()).toBe(0);
    expect(await links()).toHaveLength(0);
  });

  it("re-linka pelo mewkiTaskId em vez de importar de novo", async () => {
    const task = own({ title: "Reunião", updatedAt: NOW - 2 * HOUR });
    await insertTask(env.DB, userId, task);
    respond = () =>
      page([
        ev("perdido", {
          summary: "Reunião",
          extendedProperties: { private: { mewkiTaskId: task.id } },
        }),
      ]);
    expect(await sync()).toEqual({ imported: 0 });
    expect(await linkOf("perdido")).toMatchObject({ task_id: task.id, imported: 0 });
    expect(await taskCount()).toBe(1);
    expect((await getTask(env.DB, userId, task.id))?.priority).toBe(2);
  });

  it("eco: `updated` que já foi aplicado não mexe na tarefa", async () => {
    respond = () => page([ev("ev1")]);
    await sync();
    respond = () => page([ev("ev1", { summary: "Outro título" })]);
    await sync();
    expect((await taskOf("ev1"))?.title).toBe("Psico");
    expect((await linkOf("ev1"))?.stale).toBe(0);
  });

  it("Meet trocado ou tirado no Google: o antigo não fica pra trás nos links", async () => {
    const meet = (code: string) => `https://meet.google.com/${code}`;
    respond = () => page([ev("ev1", { hangoutLink: meet("abc-defg-hij") })]);
    await sync();
    respond = () =>
      page([ev("ev1", { hangoutLink: meet("xyz-wxyz-xyz"), updated: iso(NOW - 10 * 60_000) })]);
    await sync();
    const html = "https://www.google.com/calendar/event?eid=ev1";
    expect((await taskOf("ev1"))?.links).toEqual([html, meet("xyz-wxyz-xyz")]);
    respond = () => page([ev("ev1", { updated: iso(NOW - 5 * 60_000) })]);
    await sync();
    expect((await taskOf("ev1"))?.links).toEqual([html]);
  });

  it("LWW: Google mais novo aplica (e preserva o que é só da Mewki); Mewki mais nova fica stale", async () => {
    respond = () => page([ev("ev1")]);
    await sync();
    const imported = await taskOf("ev1");
    await env.DB.prepare(`UPDATE tasks SET priority=3, tags='["casa"]', updated_at=? WHERE id=?`)
      .bind(NOW - 30 * 60_000, imported?.id)
      .run();

    respond = () => page([ev("ev1", { summary: "Psico nova", updated: iso(NOW - 10 * 60_000) })]);
    await sync();
    expect(await taskOf("ev1")).toMatchObject({
      title: "Psico nova",
      priority: 3,
      tags: ["casa"],
      updatedAt: NOW - 10 * 60_000,
    });

    await env.DB.prepare(`UPDATE tasks SET title='Da Mewki', updated_at=? WHERE id=?`)
      .bind(NOW - 60_000, imported?.id)
      .run();
    respond = () => page([ev("ev1", { summary: "Do Google", updated: iso(NOW - 5 * 60_000) })]);
    await sync();
    expect((await taskOf("ev1"))?.title).toBe("Da Mewki");
    expect(await linkOf("ev1")).toMatchObject({ stale: 1, remote_updated: NOW - 5 * 60_000 });
  });

  it("convite que só o organizador muda: readonly, e o Google sempre ganha", async () => {
    respond = () => page([ev("convite", { organizer: { email: "chefe@x.com" } })]);
    await sync();
    expect((await linkOf("convite"))?.readonly).toBe(1);
    const t = await taskOf("convite");
    await env.DB.prepare(`UPDATE tasks SET updated_at=? WHERE id=?`).bind(NOW, t?.id).run();
    respond = () =>
      page([
        ev("convite", {
          organizer: { email: "chefe@x.com" },
          summary: "Mudou",
          updated: iso(NOW - 60_000),
        }),
      ]);
    await sync();
    expect((await taskOf("convite"))?.title).toBe("Mudou");
    expect((await linkOf("convite"))?.stale).toBe(0);

    respond = () =>
      page([ev("pode", { organizer: { email: "chefe@x.com" }, guestsCanModify: true })]);
    await sync();
    expect((await linkOf("pode"))?.readonly).toBe(0);
  });

  it("pula o que não cabe: regra sem forma e dia inteiro recorrente contam em skipped", async () => {
    respond = () =>
      page([
        ev("horaria", { recurrence: ["RRULE:FREQ=HOURLY"] }),
        ev("aniversario", {
          start: { date: "2026-12-01" },
          end: { date: "2026-12-02" },
          recurrence: ["RRULE:FREQ=YEARLY"],
        }),
        ev("ferias", { start: { date: "2026-12-01" }, end: { date: "2026-12-05" } }),
        ev("ausencia", { eventType: "outOfOffice" }),
        ev("recusado", { attendees: [{ self: true, responseStatus: "declined" }] }),
      ]);
    expect(await sync()).toEqual({ imported: 0 });
    expect(await taskCount()).toBe(0);
    expect((await conn())?.skipped).toBe(3);
    // Full recompõe; incremental soma.
    await sync(true);
    expect((await conn())?.skipped).toBe(3);
    respond = () => page([ev("horaria", { recurrence: ["RRULE:FREQ=HOURLY"] })]);
    await sync();
    expect((await conn())?.skipped).toBe(4);
  });

  it("dia inteiro único: Sem data, lembrete 09:00 como âncora, sem push", async () => {
    respond = () =>
      page([ev("dia", { start: { date: "2026-12-01" }, end: { date: "2026-12-02" } })]);
    await sync();
    const anchor = zonedEpoch(
      { year: 2026, month: 11, day: 1, hour: 9, minute: 0, second: 0 },
      "UTC",
    );
    const task = await taskOf("dia");
    expect(task).toMatchObject({ undated: true, alert: anchor, date: anchor });
    const row = await env.DB.prepare(`SELECT alert_sent FROM tasks WHERE id=?`)
      .bind(task?.id)
      .first<{ alert_sent: number | null }>();
    expect(row?.alert_sent).toBe(anchor);
  });

  it("duplicata: grava duplicate_of com a tarefa própria sem vínculo", async () => {
    const mine = own({ title: "Psico" });
    await insertTask(env.DB, userId, mine);
    respond = () => page([ev("ev1")]);
    await sync();
    expect((await linkOf("ev1"))?.duplicate_of).toBe(mine.id);
  });

  it("throttle: a segunda passada em 60 s nem chama o Google; o full passa por cima", async () => {
    respond = () => page([ev("ev1")]);
    await sync();
    expect(await syncCalendar(env, userId)).toEqual({ imported: 0 });
    expect(lists).toHaveLength(1);
    await syncCalendar(env, userId, { full: true });
    expect(lists).toHaveLength(2);
  });

  it("conexão revogada não sincroniza", async () => {
    await env.DB.prepare(`UPDATE integration_connections SET status='revoked' WHERE user_id=?`)
      .bind(userId)
      .run();
    expect(await sync()).toEqual({ imported: 0 });
    expect(lists).toHaveLength(0);
  });

  it("cron: varre as conexões que esperam há mais tempo", async () => {
    respond = () => page([ev("ev1")]);
    await syncOldest(env);
    expect((await conn())?.synced_at).toBeGreaterThanOrEqual(NOW);
    expect(await linkOf("ev1")).toBeDefined();
  });
});
