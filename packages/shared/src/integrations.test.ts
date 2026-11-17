import { describe, it, expect } from "vitest";
import {
  calendarEventPreview,
  calendarSlot,
  canUseIntegration,
  durationMinutes,
  minutesToDuration,
  isCalendarEventLink,
  isProviderId,
  matchExternalEvent,
  PROVIDER_IDS,
  videoLink,
  type ExternalEvent,
} from "./integrations";
import { zonedEpoch } from "./timezone";
import type { Task } from "./types";

describe("integrations", () => {
  it("Google Agenda vale em todo plano", () => {
    for (const role of ["free", "pro", "max", "admin"] as const)
      expect(canUseIntegration(role, "google-calendar")).toBe(true);
  });

  it("isProviderId só aceita chave própria do catálogo", () => {
    expect(isProviderId("google-calendar")).toBe(true);
    expect(isProviderId("toString")).toBe(false);
    expect(isProviderId(1)).toBe(false);
    expect(PROVIDER_IDS).toEqual(["google-calendar"]);
  });
});

const TZ = "America/Sao_Paulo";
const at = (day: number, hour: number, minute = 0) =>
  zonedEpoch({ year: 2026, month: 10, day, hour, minute, second: 0 }, TZ);
const task = (over: Partial<Task> = {}): Task => ({
  id: "t1",
  title: "Reunião",
  date: at(16, 15),
  duration: "30m",
  priority: 0,
  repeat: "Off",
  completed: [],
  ...over,
});
const now = at(15, 10);

describe("calendário", () => {
  it("durationMinutes lê o formato da tarefa", () => {
    expect(durationMinutes("1h30m")).toBe(90);
    expect(durationMinutes("2h")).toBe(120);
    expect(durationMinutes("45m")).toBe(45);
    expect(durationMinutes("")).toBe(10);
    for (const m of [90, 120, 45, 5]) expect(durationMinutes(minutesToDuration(m))).toBe(m);
    expect(minutesToDuration(60)).toBe("1h");
  });

  it("slot: horário, dia inteiro pelo lembrete, e Sem data sem dia", () => {
    expect(calendarSlot(task(), TZ)).toEqual({
      allDay: false,
      start: at(16, 15),
      end: at(16, 15, 30),
    });
    expect(calendarSlot(task({ undated: true, alert: at(18, 9) }), TZ)).toMatchObject({
      allDay: true,
      day: { year: 2026, month: 10, day: 18 },
    });
    expect(calendarSlot(task({ undated: true }), TZ)).toBeNull();
  });

  it("preview diz quando e se cria Meet", () => {
    expect(calendarEventPreview(task(), TZ, { meet: true, now })).toBe(
      "Criar evento na Agenda · amanhã 15:00–15:30 · com Meet",
    );
    expect(
      calendarEventPreview(task({ links: ["https://meet.google.com/abc-defg-hij"] }), TZ, {
        meet: true,
        now,
      }),
    ).toBe("Criar evento na Agenda · amanhã 15:00–15:30");
    expect(
      calendarEventPreview(task({ undated: true, alert: at(15, 9), repeat: "Daily" }), TZ, {
        meet: false,
        now,
      }),
    ).toBe("Criar evento na Agenda · todo dia, dia inteiro, desde 15/11");
    expect(calendarEventPreview(task({ undated: true }), TZ, { meet: false, now })).toBeNull();
  });

  it("série: a regra e o início da série, não o dia da instância", () => {
    const weekly = task({ date: at(16, 10), repeat: { Weekly: ["Monday"] } });
    const instance = { ...weekly, date: at(30, 10), seriesStart: weekly.date };
    expect(calendarEventPreview(instance, TZ, { meet: false, now })).toBe(
      "Criar evento na Agenda · toda segunda 10:00–10:30, desde 16/11",
    );
    const rule = (over: Partial<Task>) =>
      calendarEventPreview(task(over), TZ, { meet: false, now })?.split(" · ")[1];
    expect(rule({ repeat: { Weekly: ["Wednesday", "Saturday"] }, repeatEvery: 2 })).toBe(
      "a cada 2 semanas, quarta e sábado 15:00–15:30, desde 16/11",
    );
    expect(rule({ repeat: { Weekly: ["Sunday"] } })).toMatch(/^todo domingo/);
    expect(rule({ repeat: "Monthly" })).toMatch(/^todo dia 16 /);
    expect(rule({ repeat: "Yearly", date: at(16, 15) + 366 * 86_400_000 })).toMatch(
      /^todo ano em 17\/11 .*desde 17\/11\/2027$/,
    );
  });

  it("links de vídeo e de evento", () => {
    expect(videoLink(["https://x.com", "https://us02web.zoom.us/j/1"])).toBe(
      "https://us02web.zoom.us/j/1",
    );
    expect(videoLink(["https://notzoom.us.evil.com"])).toBeUndefined();
    expect(isCalendarEventLink("https://www.google.com/calendar/event?eid=abc")).toBe(true);
    expect(isCalendarEventLink("https://google.com/calendar/event?eid=abc")).toBe(false);
  });
});

describe("matchExternalEvent", () => {
  const ev = (over: Partial<ExternalEvent> = {}): ExternalEvent => ({
    id: "g1",
    title: "Reunião com o time",
    start: at(16, 15),
    end: at(16, 16),
    allDay: false,
    url: "https://www.google.com/calendar/event?eid=g1",
    ...over,
  });
  const t = (over: Partial<Task> = {}) => task({ title: "reuniao  com o TIME", ...over });

  it("mesmo título normalizado e início até 15 min", () => {
    expect(matchExternalEvent(t({ date: at(16, 15, 15) }), [ev()])?.id).toBe("g1");
    expect(matchExternalEvent(t({ date: at(16, 15, 16) }), [ev()])).toBeUndefined();
    expect(matchExternalEvent(t({ title: "Outra" }), [ev()])).toBeUndefined();
    expect(matchExternalEvent(t(), [ev({ allDay: true })])).toBeUndefined();
  });

  it("mesmo Meet casa em qualquer horário e título; querystring não importa", () => {
    const meet = "https://meet.google.com/abc-defg-hij";
    const hit = t({ title: "x", date: at(16, 9), links: [`${meet}?authuser=0`] });
    expect(matchExternalEvent(hit, [ev({ title: "y", meet })])?.id).toBe("g1");
    expect(matchExternalEvent(hit, [ev({ title: "y", meet: "https://meet.google.com/zzz" })])).toBe(
      undefined,
    );
  });

  it("não sugere pra tarefa vinculada, recorrente ou Sem data, nem evento da Mewki ou de série", () => {
    const linked = t({ links: ["https://www.google.com/calendar/event?eid=z"] });
    expect(matchExternalEvent(linked, [ev()])).toBeUndefined();
    expect(matchExternalEvent(t({ repeat: "Daily" }), [ev()])).toBeUndefined();
    expect(matchExternalEvent(t({ undated: true }), [ev()])).toBeUndefined();
    expect(matchExternalEvent(t(), [ev({ mewkiTaskId: "t1" })])).toBeUndefined();
    expect(matchExternalEvent(t(), [ev({ recurring: true })])).toBeUndefined();
  });
});
