import { describe, test, expect } from "vitest";
import { collapseQueue, type Mutation } from "./offline";

const input = {
  title: "Dentista",
  date: new Date(2026, 7, 30, 15).getTime(),
  duration: "1h",
  priority: 0,
  repeat: "Off" as const,
};

const create = (taskId: string, at = 1): Mutation => ({ op: "create", taskId, input, at });
const patch = (taskId: string, p: Record<string, unknown>, at = 2): Mutation => ({
  op: "patch",
  taskId,
  patch: p,
  at,
});

describe("collapseQueue", () => {
  test("keeps unrelated mutations in order", () => {
    const queue = [create("a"), create("b"), patch("c", { title: "x" })];
    expect(collapseQueue(queue).map((m) => `${m.op}:${m.taskId}`)).toEqual([
      "create:a",
      "create:b",
      "patch:c",
    ]);
  });

  test("does not mutate the queue it was given", () => {
    const original = patch("a", { title: "um" });
    collapseQueue([original, patch("a", { title: "dois" })]);
    expect(original.op === "patch" && original.patch).toEqual({ title: "um" });
  });

  test("folds repeated edits of the same task into one", () => {
    const queue = [
      patch("a", { title: "um" }, 2),
      patch("a", { title: "dois" }, 3),
      patch("a", { priority: 3 }, 4),
    ];
    const out = collapseQueue(queue);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ op: "patch", patch: { title: "dois", priority: 3 }, at: 4 });
  });

  test("folds an edit into a creation that hasn't gone up yet", () => {
    const out = collapseQueue([create("a"), patch("a", { title: "editado" })]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ op: "create", input: { title: "editado" } });
  });

  test("creating and deleting offline leaves nothing behind", () => {
    expect(
      collapseQueue([
        create("a"),
        patch("a", { title: "x" }),
        { op: "delete", taskId: "a", at: 5 },
      ]),
    ).toEqual([]);
  });

  test("deleting a task that exists on the server drops its pending edits, not the delete", () => {
    const out = collapseQueue([patch("a", { title: "x" }), { op: "delete", taskId: "a", at: 5 }]);
    expect(out).toEqual([{ op: "delete", taskId: "a", at: 5 }]);
  });

  test("complete and uncomplete cancel out — only the last state matters", () => {
    const out = collapseQueue([
      { op: "complete", taskId: "a", at: 1 },
      { op: "uncomplete", taskId: "a", day: 2, at: 2 },
      { op: "complete", taskId: "a", at: 3 },
    ]);
    expect(out).toEqual([{ op: "complete", taskId: "a", at: 3 }]);
  });

  test("a delete does not touch another task's pending work", () => {
    const out = collapseQueue([patch("a", { title: "x" }), { op: "delete", taskId: "b", at: 5 }]);
    expect(out.map((m) => `${m.op}:${m.taskId}`)).toEqual(["patch:a", "delete:b"]);
  });
});
