import { describe, expect, it } from "vitest";
import type { Task } from "@dailify/shared";

import type { TaskFormValues } from "@/components/dashboard/task-form";
import { buildEdit, editTaskInput, rebaseLinks } from "./edit-input";
import { zonedAt } from "./zone";

const now = zonedAt(2026, 9, 21, 14, 0); // qua 21/out 14:00
const values: TaskFormValues = {
  title: "Pagar boleto",
  date: new Date(2026, 9, 22, 15, 30),
  duration: "10m",
  priority: 0,
  repeat: "Off",
  repeatEvery: 1,
  undated: false,
};

describe("editTaskInput", () => {
  it("agenda → Sem data com dia: lembrete às 09:00 daquele dia", () => {
    const input = editTaskInput({ ...values, undated: true, reminder: new Date(2026, 9, 23) }, now);
    const at = new Date(2026, 9, 23, 9).getTime();
    expect(input).toMatchObject({ date: at, alert: at, undated: true });
  });

  it("Sem data → agenda: sai de undated, date com a hora do form", () => {
    const input = editTaskInput({ ...values, reminder: new Date(2026, 9, 23) }, now);
    expect(input).toMatchObject({ date: values.date.getTime(), undated: false });
    expect(input).not.toHaveProperty("alert");
  });

  it("Sem data sem lembrete: date = agora, sem alert", () => {
    const input = editTaskInput({ ...values, undated: true }, now);
    expect(input).toMatchObject({ date: now.getTime(), undated: true });
    expect(input).not.toHaveProperty("alert");
  });

  it("dia de hoje já passado das 09:00: avulsa fica sem lembrete, série vai pra próxima", () => {
    const today = { ...values, undated: true, reminder: new Date(2026, 9, 21) };
    expect(editTaskInput(today, now)).not.toHaveProperty("alert");
    const next = new Date(2026, 9, 22, 9).getTime();
    expect(editTaskInput({ ...today, repeat: "Daily" }, now)).toMatchObject({ alert: next });
  });
});

describe("buildEdit", () => {
  const task: Task = {
    id: "t",
    title: values.title,
    date: values.date.getTime(),
    duration: values.duration,
    priority: 0,
    repeat: "Off",
    completed: [],
  };

  it("reads the untouched form as unchanged and stamps the edit time", () => {
    const { unchanged, taskData } = buildEdit(task, values, now);
    expect(unchanged).toBe(true);
    expect(taskData.updatedAt).toBe(now.getTime());
  });

  it("keeps an undated task's date when the reminder is cleared, and sees the change", () => {
    const undated = { ...task, undated: true, alert: task.date };
    const { unchanged, taskData } = buildEdit(undated, { ...values, undated: true }, now);
    expect(taskData).toMatchObject({ date: task.date, alert: undefined });
    expect(unchanged).toBe(false);
  });

  it("gives a task moved to the agenda an alert at its date", () => {
    const undated = { ...task, undated: true };
    const { taskData } = buildEdit(undated, { ...values, before: 0 }, now);
    expect(taskData).toMatchObject({ date: values.date.getTime(), alert: values.date.getTime() });
  });

  it("keeps the reminder's distance when the time changes", () => {
    const reminded = { ...task, alert: task.date - 30 * 60_000 };
    const later = new Date(2026, 9, 22, 18);
    const { taskData, unchanged } = buildEdit(
      reminded,
      { ...values, date: later, before: 30 },
      now,
    );
    expect(taskData.alert).toBe(later.getTime() - 30 * 60_000);
    expect(unchanged).toBe(false);
  });

  it("reads a later instance with its series' reminder as unchanged", () => {
    const anchor = task.date - 7 * 86_400_000;
    const instance = { ...task, repeat: "Daily" as const, seriesStart: anchor, alert: anchor };
    const form = { ...values, repeat: "Daily" as const, before: 0 };
    expect(buildEdit(instance, form, now).unchanged).toBe(true);
  });

  it("sees a cleared on-time reminder as a change", () => {
    const { taskData, unchanged } = buildEdit({ ...task, alert: task.date }, values, now);
    expect(taskData.alert).toBeUndefined();
    expect(unchanged).toBe(false);
  });
});

describe("rebaseLinks", () => {
  const own = "https://example.com/a";
  const event = "https://www.google.com/calendar/event?eid=x";

  it("untouched form takes the server's links, Calendar event included", () => {
    expect(rebaseLinks([own], [own], [own, event])).toEqual([own, event]);
    expect(rebaseLinks(undefined, undefined, [event])).toEqual([event]);
  });

  it("keeps the user's link edits on top of a link the server added", () => {
    const next = "https://example.com/b";
    expect(rebaseLinks([next], [own], [own, event])).toEqual([event, next]);
  });
});
