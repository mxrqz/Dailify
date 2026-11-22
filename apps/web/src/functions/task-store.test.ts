/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeTask } from "@dailify/shared/testing";
import type { TaskSync } from "@dailify/shared";

const api = vi.hoisted(() => ({
  syncTasks: vi.fn(),
  getTasksForMonth: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  completeTask: vi.fn(),
  uncompleteTask: vi.fn(),
  uncompleteTaskRange: vi.fn(),
  deleteTask: vi.fn(),
}));
vi.mock("./api", () => api);

import { loadLocal, saveMeta, saveRows } from "./local-db";
import { enqueue, flushQueue, readQueue } from "./offline";
import { loadTaskMonth, openTasks, pullTasks, setDated, tasksSnapshot } from "./task-store";
import { setAppTimeZone, zonedAt } from "./zone";

const NOW = +zonedAt(2026, 10, 22, 12);
const task = makeTask({ id: "a", title: "antes", date: +zonedAt(2026, 10, 23, 9) });
const pulled = (over: Partial<TaskSync>): { sync: TaskSync } => ({
  sync: { full: false, tasks: [], deleted: [], cursor: "c2", ...over },
});
const titles = () => tasksSnapshot().dated?.map((t) => t.title);

beforeEach(() => {
  setAppTimeZone("America/Sao_Paulo");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
  setAppTimeZone(null);
});

describe("task store", () => {
  it("paints IndexedDB at once, then pulls from its cursor", async () => {
    await saveRows("boot", [task], []);
    await saveMeta("boot", { cursor: "c1" });
    await openTasks("boot");
    expect(titles()).toEqual(["antes"]);

    api.syncTasks.mockResolvedValueOnce(pulled({ tasks: [{ ...task, title: "depois" }] }));
    await pullTasks();
    expect(api.syncTasks).toHaveBeenCalledWith("c1");
    expect(titles()).toEqual(["depois"]);
    expect(await loadLocal("boot")).toMatchObject({ rows: [{ title: "depois" }], cursor: "c2" });
  });

  it("an offline write survives a pull until the outbox drains, then the pull settles it", async () => {
    await openTasks("off");
    api.syncTasks.mockResolvedValueOnce(pulled({ full: true, tasks: [task] }));
    await pullTasks();

    const edited = { ...task, title: "offline" };
    setDated((cur = []) => cur.map((t) => (t.id === "a" ? edited : t)));
    enqueue("off", { op: "patch", taskId: "a", patch: { title: "offline" }, at: NOW });
    vi.setSystemTime(NOW + 60_000);
    api.syncTasks.mockResolvedValueOnce(pulled({ tasks: [task], cursor: "c3" }));
    await pullTasks();
    expect(titles()).toEqual(["offline"]);
    expect((await loadLocal("off"))?.cursor).toBe("c2");

    api.updateTask.mockResolvedValueOnce({ task: edited });
    await flushQueue("off");
    expect(readQueue("off")).toEqual([]);
    api.syncTasks.mockResolvedValueOnce(pulled({ tasks: [edited], cursor: "c4" }));
    await pullTasks();
    expect(api.syncTasks).toHaveBeenLastCalledWith("c2");
    expect(titles()).toEqual(["offline"]);
    expect((await loadLocal("off"))?.cursor).toBe("c4");
  });

  it("an account switch clears the previous user's lists", async () => {
    await saveRows("one", [task], []);
    await openTasks("one");
    expect(titles()).toEqual(["antes"]);
    const opening = openTasks("two");
    expect(tasksSnapshot().dated).toBeUndefined();
    await opening;
    expect(tasksSnapshot().dated).toBeUndefined();
  });

  it("fetches a month older than the window on demand and never stores it", async () => {
    await openTasks("old");
    const old = makeTask({ id: "o", title: "velha", date: +zonedAt(2026, 0, 10, 9) });
    api.getTasksForMonth.mockResolvedValueOnce({ tasks: [old] });
    await loadTaskMonth(zonedAt(2026, 0, 10));
    await loadTaskMonth(zonedAt(2026, 0, 20));
    expect(api.getTasksForMonth).toHaveBeenCalledTimes(1);
    expect(titles()).toEqual(["velha"]);
    expect(tasksSnapshot().months.map(Number)).toContain(+zonedAt(2026, 0, 1));

    setDated((cur = []) => cur.map((t) => ({ ...t, title: "editada" })));
    expect((await loadLocal("old"))?.rows).toEqual([]);
  });

  it("expands a month inside the window locally", async () => {
    await openTasks("local");
    await loadTaskMonth(zonedAt(2027, 2, 1));
    expect(api.getTasksForMonth).not.toHaveBeenCalled();
    expect(tasksSnapshot().months.map(Number)).toContain(+zonedAt(2027, 2, 1));
  });

  it("migrates the localStorage cache and outbox once", async () => {
    const series = makeTask({ id: "r", repeat: "Daily", date: +zonedAt(2026, 10, 1, 8) });
    const instance = { ...series, date: +zonedAt(2026, 10, 2, 8), seriesStart: series.date };
    const queued = { op: "complete" as const, taskId: "r", at: NOW };
    localStorage.setItem("dailify:tasks:mig", JSON.stringify([series, instance]));
    localStorage.setItem("dailify:outbox:mig", JSON.stringify([queued]));
    await openTasks("mig");

    expect(readQueue("mig")).toEqual([queued]);
    await vi.waitFor(() => expect(localStorage.getItem("dailify:outbox:mig")).toBeNull());
    expect(await loadLocal("mig")).toMatchObject({ rows: [series], queue: [queued] });
  });
});
