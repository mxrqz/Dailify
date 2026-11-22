import { describe, it, expect } from "vitest";
import {
  calendarEventPreview,
  calendarSlot,
  canUseIntegration,
  isProviderId,
  matchDuplicate,
  PROVIDER_IDS,
} from "./integrations";
import { isCalendarEventLink, meetLink, videoLink } from "./parse-links";
import { durationMinutes, isDuration, minutesToDuration } from "./duration";
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
    expect(PROVIDER_IDS).toEqual(["google-calendar", "slack"]);
  });

  it("Slack is Pro and up", () => {
    expect(canUseIntegration("free", "slack")).toBe(false);
    for (const role of ["pro", "max", "admin"] as const)
      expect(canUseIntegration(role, "slack")).toBe(true);
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

  it("isDuration accepts only the Task.duration format", () => {
    for (const d of ["10m", "1h", "1h30m", "0m"]) expect(isDuration(d)).toBe(true);
    for (const d of ["", "10", "1h 30m", "30m1h", "dez minutos", 10])
      expect(isDuration(d)).toBe(false);
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

  it("slot: midnight to midnight in the zone is all-day for that many days", () => {
    expect(calendarSlot(task({ date: at(20, 0), duration: "72h" }), TZ)).toMatchObject({
      allDay: true,
      day: { year: 2026, month: 10, day: 20 },
      days: 3,
    });
    // Midnight start but a part-day end, or a whole-day span off midnight, stays timed.
    expect(calendarSlot(task({ date: at(20, 0), duration: "30h" }), TZ)?.allDay).toBe(false);
    expect(calendarSlot(task({ date: at(20, 1), duration: "48h" }), TZ)?.allDay).toBe(false);
    // Midnight in UTC is 21:00 in São Paulo: not all-day there.
    expect(calendarSlot(task({ date: Date.UTC(2026, 10, 20), duration: "48h" }), TZ)?.allDay).toBe(
      false,
    );
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
    expect(meetLink(["https://x.com", "https://meet.google.com/abc-defg-hij?authuser=0"])).toBe(
      "https://meet.google.com/abc-defg-hij?authuser=0",
    );
    expect(meetLink(["https://meet.google.com/lookup/abc"])).toBeUndefined();
    expect(isCalendarEventLink("https://www.google.com/calendar/event?eid=abc")).toBe(true);
    expect(isCalendarEventLink("https://google.com/calendar/event?eid=abc")).toBe(false);
  });
});

describe("matchDuplicate", () => {
  const imp = (over: Partial<Task> = {}) =>
    task({ id: "imp", title: "Reunião com o time", links: [HTML], ...over });
  const own = (over: Partial<Task> = {}) => task({ title: "reuniao  com o TIME", ...over });
  const HTML = "https://www.google.com/calendar/event?eid=g1";

  it("mesmo título normalizado e início até 15 min", () => {
    expect(matchDuplicate(imp(), [own({ date: at(16, 15, 15) })], TZ)?.id).toBe("t1");
    expect(matchDuplicate(imp(), [own({ date: at(16, 15, 16) })], TZ)).toBeUndefined();
    expect(matchDuplicate(imp(), [own({ title: "Outra" })], TZ)).toBeUndefined();
  });

  it("mesmo Meet casa em qualquer horário e título; querystring não importa", () => {
    const meet = "https://meet.google.com/abc-defg-hij";
    const hit = own({ title: "x", date: at(16, 9), links: [`${meet}?authuser=0`] });
    expect(matchDuplicate(imp({ title: "y", links: [HTML, meet] }), [hit], TZ)?.id).toBe("t1");
    const other = imp({ title: "y", links: [HTML, "https://meet.google.com/zzz"] });
    expect(matchDuplicate(other, [hit], TZ)).toBeUndefined();
  });

  it("série (Psico): mesmo título, toda terça, mesma hora de parede ±15 min", () => {
    const weekly = { repeat: { Weekly: ["Tuesday"] }, title: "Psico" };
    // A importada começa numa terça de outubro; a própria, semanas depois — a hora é que conta.
    const g = imp({ ...weekly, date: at(17, 10) - 35 * 86_400_000 });
    expect(matchDuplicate(g, [own({ ...weekly, date: at(17, 10, 10) })], TZ)?.id).toBe("t1");
    expect(matchDuplicate(g, [own({ ...weekly, date: at(17, 10, 20) })], TZ)).toBeUndefined();
    expect(matchDuplicate(g, [own({ ...weekly, repeat: "Daily", date: at(17, 10) })], TZ)).toBe(
      undefined,
    );
    expect(
      matchDuplicate(g, [own({ ...weekly, repeatEvery: 2, date: at(17, 10) })], TZ),
    ).toBeUndefined();
    expect(matchDuplicate(g, [own({ title: "Psico", date: at(17, 10) })], TZ)).toBeUndefined();
  });

  it("não casa com tarefa já vinculada, Sem data, nem com ela mesma", () => {
    expect(matchDuplicate(imp(), [own({ links: [HTML] })], TZ)).toBeUndefined();
    expect(matchDuplicate(imp(), [own({ undated: true })], TZ)).toBeUndefined();
    expect(matchDuplicate(imp(), [imp()], TZ)).toBeUndefined();
  });
});
