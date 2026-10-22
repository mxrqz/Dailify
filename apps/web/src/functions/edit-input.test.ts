import { describe, expect, it } from "vitest";

import type { TaskFormValues } from "@/components/dashboard/task-form";
import { editTaskInput } from "./edit-input";

const now = new Date(2026, 9, 21, 14, 0); // qua 21/out 14:00
const values: TaskFormValues = {
  title: "Pagar boleto",
  date: new Date(2026, 9, 22, 15, 30),
  duration: "10m",
  priority: 0,
  repeat: "Off",
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
