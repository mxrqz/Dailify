import { describe, expect, it } from "vitest";
import type { Task } from "@dailify/shared";

import { dayRows, isDayZeroed, type Row } from "./day-rows";

const task = (id: string): Task => ({
  id,
  title: id,
  date: 0,
  duration: "",
  priority: 0,
  repeat: "Off",
  completed: [],
});
const at = (id: string, minutes: number): Row => ({ at: minutes, task: task(id) });
const ids = (rows: Row[]) => rows.map((r) => ("task" in r ? r.task.id : "now"));

describe("dayRows", () => {
  it("settles done tasks after the open ones and the now line, each in clock order", () => {
    const done = new Set(["a", "c"]);
    const rows = dayRows(
      [at("c", 600), at("b", 540), { at: 559.5, now: true }, at("a", 480), at("d", 720)],
      (t) => done.has(t.id),
    );
    expect(ids(rows)).toEqual(["b", "now", "d", "a", "c"]);
  });
});

describe("isDayZeroed", () => {
  it("is true only when the day has tasks and all are done", () => {
    expect(isDayZeroed([], () => true)).toBe(false);
    expect(isDayZeroed([task("a"), task("b")], (t) => t.id === "a")).toBe(false);
    expect(isDayZeroed([task("a"), task("b")], () => true)).toBe(true);
  });
});
