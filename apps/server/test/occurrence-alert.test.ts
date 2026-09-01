import { describe, it, expect } from "vitest";
import type { Task } from "@dailify/shared";
import { dueOccurrenceAlert } from "../src/lib/occurrence-alert";

const SP = "America/Sao_Paulo";
const GRACE = 60 * 60 * 1000;

/** Diária às 09:00 de São Paulo (12:00Z), com alerta 10 min antes. */
const daily: Task = {
  id: "s1",
  title: "Academia",
  date: Date.UTC(2026, 4, 1, 12, 0),
  alert: Date.UTC(2026, 4, 1, 11, 50),
  duration: "1h",
  priority: 0,
  repeat: "Daily",
  completed: [],
};

describe("dueOccurrenceAlert", () => {
  it("dispara a ocorrência do dia, não a original", () => {
    const now = Date.UTC(2026, 4, 20, 11, 52); // 2 min depois do alerta do dia 20
    expect(dueOccurrenceAlert(daily, null, SP, now, GRACE)).toBe(Date.UTC(2026, 4, 20, 11, 50));
  });

  it("não dispara antes da hora", () => {
    const now = Date.UTC(2026, 4, 20, 11, 30);
    expect(dueOccurrenceAlert(daily, null, SP, now, GRACE)).toBeNull();
  });

  // O que impede a mesma notificação a cada 5 minutos.
  it("não repete a ocorrência já avisada", () => {
    const alertAt = Date.UTC(2026, 4, 20, 11, 50);
    const now = Date.UTC(2026, 4, 20, 12, 10);
    expect(dueOccurrenceAlert(daily, alertAt, SP, now, GRACE)).toBeNull();
  });

  it("a ocorrência do dia seguinte volta a valer", () => {
    const ontem = Date.UTC(2026, 4, 20, 11, 50);
    const now = Date.UTC(2026, 4, 21, 11, 52);
    expect(dueOccurrenceAlert(daily, ontem, SP, now, GRACE)).toBe(Date.UTC(2026, 4, 21, 11, 50));
  });

  it("cron parado por horas manda só o mais recente", () => {
    const now = Date.UTC(2026, 4, 22, 11, 55);
    // com 3 dias de folga, três ocorrências venceram — vale a última
    expect(dueOccurrenceAlert(daily, null, SP, now, 3 * 24 * GRACE)).toBe(
      Date.UTC(2026, 4, 22, 11, 50),
    );
  });

  it("ignora a ocorrência destacada da série (exdates)", () => {
    const semDia20: Task = { ...daily, exdates: [Date.UTC(2026, 4, 20, 12, 0)] };
    const now = Date.UTC(2026, 4, 20, 11, 52);
    expect(dueOccurrenceAlert(semDia20, null, SP, now, GRACE)).toBeNull();
  });

  it("respeita os dias da semana no fuso do usuário", () => {
    // 22:00 de domingo em São Paulo (01:00Z de segunda), alerta na hora
    const sundayNight: Task = {
      ...daily,
      repeat: { Weekly: ["Sunday"] },
      date: Date.UTC(2026, 4, 4, 1, 0),
      alert: Date.UTC(2026, 4, 4, 1, 0),
    };
    // domingo seguinte, 10/05 22:00 SP = 11/05 01:00Z
    const now = Date.UTC(2026, 4, 11, 1, 1);
    expect(dueOccurrenceAlert(sundayNight, null, SP, now, GRACE)).toBe(Date.UTC(2026, 4, 11, 1, 0));

    // uma terça qualquer não dispara nada
    const terca = Date.UTC(2026, 4, 13, 1, 1);
    expect(dueOccurrenceAlert(sundayNight, null, SP, terca, GRACE)).toBeNull();
  });

  it("acha a ocorrência do mês anterior quando a janela cruza a virada", () => {
    // 31/05 23:50 SP = 01/06 02:50Z; o cron roda às 03:00Z já em junho
    const lateNight: Task = {
      ...daily,
      date: Date.UTC(2026, 4, 2, 2, 50),
      alert: Date.UTC(2026, 4, 2, 2, 50),
    };
    const now = Date.UTC(2026, 5, 1, 3, 0);
    expect(dueOccurrenceAlert(lateNight, null, SP, now, GRACE)).toBe(Date.UTC(2026, 5, 1, 2, 50));
  });

  it("tarefa sem alerta não gera nada", () => {
    expect(dueOccurrenceAlert({ ...daily, alert: undefined }, null, SP, Date.now(), GRACE)).toBeNull();
  });
});
