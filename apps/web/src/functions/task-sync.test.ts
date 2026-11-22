import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeTask } from "@dailify/shared/testing";
import type { Task, TaskSync } from "@dailify/shared";

import { addMonth, applySync, applyWrite, inWindow, rowOf, viewOf, windowStart } from "./task-sync";
import type { TaskState } from "./task-sync";
import { upsertTaskWithRecurrence } from "./functions";
import { setAppTimeZone, zonedAt } from "./zone";

const NOV = zonedAt(2026, 10, 1);
const DEC = zonedAt(2026, 11, 1);
const months = [NOV, DEC];
const start = +zonedAt(2026, 4, 1);

const oneOff = makeTask({ id: "a", date: +zonedAt(2026, 10, 5, 9) });
const daily = makeTask({ id: "r", repeat: "Daily", date: +zonedAt(2026, 10, 28, 8) });
const undated = makeTask({ id: "u", undated: true, date: +zonedAt(2026, 10, 1) });

const stateOf = (...rows: Task[]): TaskState => {
  const map = new Map(rows.map((t) => [t.id, t]));
  return { rows: map, ...viewOf(map.values(), months) };
};
const sync = (over: Partial<TaskSync>): TaskSync => ({
  full: false,
  tasks: [],
  deleted: [],
  cursor: "c2",
  ...over,
});
const opts = (keep: string[] = []) => ({ keep: new Set(keep), months, start });
const datesOf = (list: Task[], id: string) => list.filter((t) => t.id === id).map((t) => t.date);

beforeEach(() => setAppTimeZone("America/Sao_Paulo"));
afterEach(() => setAppTimeZone(null));

describe("viewOf", () => {
  it("expands series per loaded month and keeps undated apart", () => {
    const view = viewOf([oneOff, daily, undated], months);
    // Nov 28 (the row) + 29, 30 + 31 days of December.
    expect(datesOf(view.dated, "r")).toHaveLength(34);
    expect(view.dated.filter((t) => t.id === "a")).toEqual([oneOff]);
    expect(view.undated).toEqual([undated]);
  });

  it("addMonth expands the stored series into a newly shown month", () => {
    const next = addMonth(stateOf(daily, oneOff), zonedAt(2027, 0, 1));
    expect(datesOf(next.dated, "r")).toHaveLength(34 + 31);
  });
});

describe("windowStart / inWindow", () => {
  it("starts 183 days back at midnight and keeps live series and undated", () => {
    const now = +zonedAt(2026, 10, 22, 15);
    expect(windowStart(now)).toBe(+zonedAt(2026, 4, 23));
    const old = +zonedAt(2026, 0, 1);
    expect(inWindow(makeTask({ date: old }), start)).toBe(false);
    expect(inWindow(makeTask({ date: old, undated: true }), start)).toBe(true);
    expect(inWindow(makeTask({ date: old, repeat: "Daily" }), start)).toBe(true);
    expect(inWindow(makeTask({ date: old, repeat: "Daily", repeatUntil: old }), start)).toBe(false);
  });
});

describe("rowOf", () => {
  it("turns an occurrence the list dropped into an exdate, and back on undo", () => {
    const list = upsertTaskWithRecurrence([], daily, months);
    const dec3 = +zonedAt(2026, 11, 3, 8);
    const without = list.filter((t) => t.date !== dec3);
    expect(rowOf(without, months).exdates).toEqual([dec3]);
    const row = rowOf(without, months);
    const undone = [
      ...upsertTaskWithRecurrence([], row, months),
      ...list.filter((t) => t.date === dec3),
    ];
    expect(rowOf(undone, months).exdates).toEqual([]);
  });

  it("reads the series from an instance when the anchor entry is gone", () => {
    const list = upsertTaskWithRecurrence([], daily, months).filter((t) => t.date !== daily.date);
    expect(rowOf(list, months)).toMatchObject({ id: "r", date: daily.date });
  });
});

describe("applyWrite", () => {
  it("stores the touched task's row and leaves the others alone", () => {
    const state = stateOf(oneOff, daily);
    const renamed = { ...daily, title: "novo" };
    const out = applyWrite(state, "dated", upsertTaskWithRecurrence(state.dated, renamed, months), {
      months,
      start,
    });
    expect(out.touched).toEqual(["r"]);
    expect(out.changes).toEqual({ put: [renamed], drop: [] });
    expect(out.state.rows.get("r")).toEqual(renamed);
  });

  it("moves a task between lists in either order without losing its row", () => {
    const scheduled = { ...undated, undated: false, date: +zonedAt(2026, 10, 9, 9) };
    const state = stateOf(undated);
    const a = applyWrite(state, "undated", [], { months, start });
    const b = applyWrite(a.state, "dated", [...a.state.dated, scheduled], { months, start });
    expect(b.state.rows.get("u")).toEqual(scheduled);

    const c = applyWrite(state, "dated", [...state.dated, scheduled], { months, start });
    const d = applyWrite(c.state, "undated", [], { months, start });
    expect(d.state.rows.get("u")).toEqual(scheduled);
    expect(d.changes.drop).toEqual([]);
  });

  it("doesn't store a task older than the window", () => {
    const old = makeTask({ id: "o", date: +zonedAt(2026, 0, 5) });
    const out = applyWrite(stateOf(), "dated", [old], { months, start });
    expect(out.state.rows.has("o")).toBe(false);
    expect(out.changes.put).toEqual([]);
  });
});

describe("applySync", () => {
  it("full replaces rows and lists with the server's", () => {
    const fresh = makeTask({ id: "b", date: +zonedAt(2026, 10, 7) });
    const out = applySync(
      stateOf(oneOff, undated),
      sync({ full: true, tasks: [fresh, daily] }),
      opts(),
    );
    expect([...out.state.rows.keys()].sort()).toEqual(["b", "r"]);
    expect(out.state.undated).toEqual([]);
    expect(datesOf(out.state.dated, "r")).toHaveLength(34);
    expect(out.changes.replace).toBe(true);
    expect(out.held).toBe(false);
  });

  it("incremental upserts then deletes", () => {
    const edited = { ...oneOff, title: "editada" };
    const out = applySync(
      stateOf(oneOff, daily, undated),
      sync({ tasks: [edited], deleted: ["r"] }),
      opts(),
    );
    expect(out.state.rows.get("a")).toEqual(edited);
    expect(out.state.rows.has("r")).toBe(false);
    expect(out.state.dated).toEqual([edited]);
    expect(out.state.undated).toEqual([undated]);
    expect(out.changes).toEqual({ put: [edited], drop: ["r"] });
  });

  it("re-expands a changed series over the loaded months", () => {
    const weekly = { ...daily, repeat: { Weekly: ["Monday"] } };
    const out = applySync(stateOf(daily), sync({ tasks: [weekly] }), opts());
    expect(datesOf(out.state.dated, "r")).toEqual(
      datesOf(upsertTaskWithRecurrence([], weekly, months), "r"),
    );
    expect(datesOf(out.state.dated, "r").length).toBeLessThan(34);
  });

  it("keeps a pending task's local copy and holds the cursor", () => {
    const local = { ...oneOff, title: "offline" };
    const state = applyWrite(stateOf(oneOff), "dated", [local], { months, start }).state;
    const server = { ...oneOff, title: "servidor" };
    for (const pull of [
      sync({ tasks: [server] }),
      sync({ deleted: ["a"] }),
      sync({ full: true }),
    ]) {
      const out = applySync(state, pull, opts(["a"]));
      expect(out.state.rows.get("a")).toEqual(local);
      expect(out.state.dated).toEqual([local]);
      expect(out.held).toBe(pull.full ? false : true);
    }
    expect(applySync(state, sync({ full: true, tasks: [server] }), opts(["a"])).held).toBe(true);
  });

  it("prunes rows that aged out of the window but keeps older months on screen", () => {
    const aging = makeTask({ id: "x", date: start - 1 });
    const state = {
      ...stateOf(oneOff),
      rows: new Map([
        ["a", oneOff],
        ["x", aging],
      ]),
      dated: [oneOff, aging],
    };
    const inc = applySync(state, sync({}), opts());
    expect(inc.state.rows.has("x")).toBe(false);
    expect(inc.changes.drop).toEqual(["x"]);
    expect(inc.state.dated).toContain(aging);
    const full = applySync(state, sync({ full: true, tasks: [oneOff] }), opts());
    expect(full.state.dated).toEqual([oneOff, aging]);
  });
});
