import { TZDate } from "@date-fns/tz";
import { describe, expect, it } from "vitest";

import {
  type ChatEvent,
  type ConfirmBlock,
  dayName,
  isOverdue,
  reply,
  seedAgenda,
  swap,
} from "./engine";

const ZONE = "America/Sao_Paulo";
// Tuesday, 2026-11-17 09:00.
const now = new TZDate(2026, 10, 17, 9, 0, ZONE);
const ctx = (extra: { image?: boolean } = {}) => {
  let n = 0;
  return { tasks: seedAgenda(now), now, nextId: () => `id-${++n}`, ...extra };
};

const text = (events: ChatEvent[]) =>
  events.flatMap((e) => (e.type === "text" ? [e.text] : [])).join(" ");
const confirmOf = (events: ChatEvent[]): ConfirmBlock => {
  for (const e of events) if (e.type === "block" && e.block.kind === "confirm") return e.block;
  throw new Error("no confirm block");
};
const at = (ms: number) => new TZDate(ms, ZONE);

describe("seedAgenda", () => {
  it("has overdue, today and future tasks relative to now", () => {
    const tasks = seedAgenda(now);
    expect(tasks.filter((task) => isOverdue(task, now))).toHaveLength(3);
    expect(tasks.some((task) => dayName(task.date, now) === "hoje")).toBe(true);
  });
});

describe("reply", () => {
  it("starts typing, then says the whole line in one event", () => {
    const events = reply("O que tenho hoje?", ctx());
    expect(events[0]).toEqual({ type: "typing", ms: expect.any(Number) });
    expect(events[1]).toEqual({ type: "text", text: "Você tem 3 coisas hoje:" });
    expect(events.filter((e) => e.type === "text")).toHaveLength(1);
  });

  it("answers what is on today with a read-only task list, in time order", () => {
    const events = reply("o que tenho hoje", ctx());
    expect(text(events)).toBe("Você tem 3 coisas hoje:");
    const block = events.at(-1);
    expect(
      block?.type === "block" &&
        block.block.kind === "tasks" &&
        block.block.tasks.map((x) => x.title),
    ).toEqual(["Academia", "Call com o time de produto", "Jantar com a Bia"]);
  });

  it("reads tomorrow too", () => {
    expect(text(reply("O que tenho amanhã?", ctx()))).toBe("Você tem 2 coisas amanhã:");
  });

  it("captures several tasks from one sentence, each with its own when", () => {
    const block = confirmOf(
      reply("comprar pão, ligar pro dentista sexta 10h e pagar luz dia 20", ctx()),
    );
    expect(block).toMatchObject({ action: "create", step: "draft", before: [] });
    expect(block.after.map((x) => x.title)).toEqual([
      "Comprar pão",
      "Ligar pro dentista",
      "Pagar luz",
    ]);
    const dentist = at(block.after[1].date);
    expect([dentist.getDate(), dentist.getHours(), block.after[1].hasTime]).toEqual([20, 10, true]);
  });

  it("reads a list from an attached image", () => {
    const block = confirmOf(reply("", ctx({ image: true })));
    expect(block.action).toBe("create");
    expect(block.after).toHaveLength(3);
  });

  it("moves overdue tasks to friday through status → draft, keeping their hour", () => {
    const events = reply("Joga os atrasados pra sexta", ctx());
    const block = confirmOf(events);
    expect(block).toMatchObject({ action: "move", step: "status", label: "sexta-feira" });
    expect(events.at(-1)).toEqual({ type: "settle", id: block.id, ms: expect.any(Number) });
    expect(block.before.map((x) => x.id)).toEqual(block.after.map((x) => x.id));
    const cnh = at(block.after[0].date);
    expect([cnh.getDate(), cnh.getHours()]).toEqual([20, 10]);
  });

  it("says so when nothing is overdue", () => {
    const c = ctx();
    c.tasks = c.tasks.filter((task) => !isOverdue(task, now));
    expect(text(reply("joga os atrasados pra sexta", c))).toBe("Nada atrasado. Você está em dia!");
  });

  it("breaks a task into steps on the parent's day", () => {
    const c = ctx();
    const block = confirmOf(reply("Quebra 'mudança' em passos", c));
    expect(block).toMatchObject({ action: "steps", label: "Mudança" });
    expect(block.after.length).toBeGreaterThan(2);
    expect(block.after[0].date).toBe(c.tasks.find((x) => x.title === "Mudança")?.date);
  });

  it("schedules a calendar event behind a confirmation", () => {
    const block = confirmOf(reply("marca reunião com a Ana amanhã 15h na Agenda", ctx()));
    expect(block).toMatchObject({ action: "event", step: "status" });
    const [event] = block.after;
    expect(event).toMatchObject({ title: "Reunião com a Ana", calendar: true, hasTime: true });
    expect([at(event.date).getDate(), at(event.date).getHours()]).toEqual([18, 15]);
  });

  it("always asks before deleting", () => {
    const block = confirmOf(reply("apaga a tarefa 'jantar com a bia'", ctx()));
    expect(block).toMatchObject({ action: "delete", step: "draft", after: [] });
    expect(block.before.map((x) => x.title)).toEqual(["Jantar com a Bia"]);
  });

  it("says it found nothing to delete", () => {
    expect(text(reply("apaga 'xpto'", ctx()))).toBe("Não achei nenhuma tarefa com esse nome.");
  });

  it("falls back kindly", () => {
    expect(text(reply("me conta uma piada", ctx()))).toMatch(/^Ainda não sei fazer isso/);
  });
});

describe("swap", () => {
  it("replaces by id", () => {
    const [a, b] = seedAgenda(now);
    expect(swap([a, b], [a], [{ ...a, title: "x" }]).map((x) => x.title)).toEqual([b.title, "x"]);
  });
});
