import { describe, expect, it } from "vitest";
import type { Task } from "@dailify/shared";

import { swapTasks, swapUndated } from "./task-lists";

const task = (id: string, extra: Partial<Task> = {}): Task => ({
  id,
  title: id,
  date: 1_763_380_800_000,
  duration: "",
  priority: 0,
  repeat: "Off",
  completed: [],
  ...extra,
});

const late = task("late");
const moved = { ...late, date: late.date + 86_400_000 };
const fresh = task("new");
const loose = task("loose", { undated: true });

describe("swapTasks and swapUndated", () => {
  it("move tasks between the agenda and the undated list, and back", () => {
    const gone = ["late", "loose"];
    const tasks = swapTasks([late, task("other")], gone, [moved, fresh], []);
    expect(tasks.map((t) => [t.id, t.date])).toEqual([
      ["other", late.date],
      ["late", moved.date],
      ["new", fresh.date],
    ]);
    expect(swapUndated([loose], gone, [moved, fresh])).toEqual([]);

    const back = ["late", "new"];
    expect(swapTasks(tasks, back, [late, loose], []).map((t) => [t.id, t.date])).toEqual([
      ["other", late.date],
      ["late", late.date],
    ]);
    expect(swapUndated([], back, [late, loose])).toEqual([loose]);
  });
});
