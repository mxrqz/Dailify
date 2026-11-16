import { describe, it, expect } from "vitest";
import {
  calendarEventPreview,
  calendarSlot,
  canUseIntegration,
  durationMinutes,
  isCalendarEventLink,
  isProviderId,
  PROVIDER_IDS,
  videoLink,
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
      "Criar evento no Google Agenda · amanhã 15:00–15:30 · com Meet",
    );
    expect(
      calendarEventPreview(task({ links: ["https://meet.google.com/abc-defg-hij"] }), TZ, {
        meet: true,
        now,
      }),
    ).toBe("Criar evento no Google Agenda · amanhã 15:00–15:30");
    expect(
      calendarEventPreview(task({ undated: true, alert: at(15, 9), repeat: "Daily" }), TZ, {
        meet: false,
        now,
      }),
    ).toBe("Criar evento no Google Agenda · todo dia, dia inteiro, desde 15/11");
    expect(calendarEventPreview(task({ undated: true }), TZ, { meet: false, now })).toBeNull();
  });

  it("série: a regra e o início da série, não o dia da instância", () => {
    const weekly = task({ date: at(16, 10), repeat: { Weekly: ["Monday"] } });
    const instance = { ...weekly, date: at(30, 10), seriesStart: weekly.date };
    expect(calendarEventPreview(instance, TZ, { meet: false, now })).toBe(
      "Criar evento no Google Agenda · toda segunda 10:00–10:30, desde 16/11",
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
