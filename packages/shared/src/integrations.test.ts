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
    ).toBe("Criar evento no Google Agenda · hoje · dia inteiro · recorrente");
    expect(calendarEventPreview(task({ undated: true }), TZ, { meet: false, now })).toBeNull();
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
