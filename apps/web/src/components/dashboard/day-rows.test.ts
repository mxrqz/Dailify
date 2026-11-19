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

  it("labels the first row of each hour run, again when a done task repeats an hour", () => {
    const rows = dayRows([at("a", 540), at("b", 545), at("c", 550)], (t) => t.id === "b");
    expect(rows.map((r) => ("task" in r ? r.hour : null))).toEqual(["09:00", undefined, "09:00"]);
  });
});

describe("isDayZeroed", () => {
  it("is true only when the day has tasks and all are done", () => {
    expect(isDayZeroed([], () => true)).toBe(false);
    expect(isDayZeroed([task("a"), task("b")], (t) => t.id === "a")).toBe(false);
    expect(isDayZeroed([task("a"), task("b")], () => true)).toBe(true);
  });
});
