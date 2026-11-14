import { afterEach, describe, expect, it } from "vitest";
import { format } from "date-fns";

import { getTasksForDay } from "./functions";
import { parseTaskText } from "./parse-task";
import { appTimeZone, deviceTimeZone, setAppTimeZone, zoned, zonedAt } from "./zone";

// Tóquio: longe de qualquer fuso em que os testes rodem, então "funcionou por acaso" não passa.
const TOKYO = "Asia/Tokyo";

describe("fuso do app", () => {
  afterEach(() => setAppTimeZone(null));

  it("automático é o fuso do aparelho", () => {
    setAppTimeZone(TOKYO);
    setAppTimeZone(null);
    expect(appTimeZone()).toBe(deviceTimeZone());
  });

  it("o parser lê '15h' como 15h no fuso escolhido", () => {
    setAppTimeZone(TOKYO);
    const parsed = parseTaskText("reunião amanhã 15h", zonedAt(2026, 10, 2, 10));
    expect(parsed.date?.getTime()).toBe(Date.UTC(2026, 10, 3, 6)); // 15h em Tóquio = 06h UTC
  });

  it("o dia de uma tarefa é o do fuso escolhido", () => {
    setAppTimeZone(TOKYO);
    // 23h UTC do dia 2 já é dia 3 em Tóquio.
    const task = {
      id: "a",
      title: "x",
      date: Date.UTC(2026, 10, 2, 23),
      duration: "10m",
      priority: 0,
      repeat: "Off" as const,
      completed: [],
    };
    expect(getTasksForDay([task], zonedAt(2026, 10, 3))).toHaveLength(1);
    expect(format(zoned(task.date), "HH:mm")).toBe("08:00");
  });
});
