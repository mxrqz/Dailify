import { describe, expect, it } from "vitest";
import type { Task } from "@dailify/shared";

import { writes } from "./apply";

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

describe("writes", () => {
  it("same id updates, a new id creates, a missing one deletes; undo is the mirror", () => {
    const done = writes([late, loose], [moved, fresh]);
    expect(done).toEqual({ create: [fresh], update: [moved], remove: [loose] });
    const undone = writes([moved, fresh], [late, loose]);
    expect(undone).toEqual({ create: [loose], update: [late], remove: [fresh] });
  });
});
