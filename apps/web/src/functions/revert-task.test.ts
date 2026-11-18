import { describe, expect, it } from "vitest";
import type { Task } from "@dailify/shared";

import { revertTask } from "./revert-task";

const t = (id: string, over: Partial<Task> = {}): Task => ({
  id,
  title: id,
  date: 0,
  duration: "",
  priority: 0,
  repeat: "Off",
  completed: [],
  ...over,
});

describe("revertTask", () => {
  it("puts back only the entries of the reverted id and keeps writes to other tasks", () => {
    const previous = [t("a"), t("b"), t("a", { date: 1 })];
    const current = [t("b", { completed: [5] }), t("a", { title: "edited" }), t("c")];
    expect(revertTask(current, previous, "a")).toEqual([
      t("b", { completed: [5] }),
      t("c"),
      t("a"),
      t("a", { date: 1 }),
    ]);
  });

  it("removes the id when it was absent before", () => {
    expect(revertTask([t("a"), t("b")], [t("b")], "a")).toEqual([t("b")]);
  });
});
