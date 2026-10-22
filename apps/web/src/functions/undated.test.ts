import { describe, expect, it } from "vitest";
import type { Task } from "@dailify/shared";

import { removeUndated, splitUndated, upsertUndated } from "./undated";

const t = (id: string, over: Partial<Task> = {}): Task => ({
  duration: "",
  priority: 0,
  id,
  title: id,
  date: 0,
  alert: 0,
  repeat: "Off",
  completed: [],
  undated: true,
  ...over,
});

describe("undated", () => {
  it("upsertUndated substitui por id mantendo a posição e anexa o novo", () => {
    const list = [t("a"), t("b")];
    expect(upsertUndated(list, t("a", { title: "novo" })).map((x) => x.title)).toEqual([
      "novo",
      "b",
    ]);
    expect(upsertUndated(list, t("c")).map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("removeUndated tira pelo id", () => {
    expect(removeUndated([t("a"), t("b")], "a").map((x) => x.id)).toEqual(["b"]);
  });

  it("splitUndated separa série e avulsa, esconde avulsa concluída e mantém série concluída", () => {
    const now = Date.UTC(2026, 9, 21, 15);
    const list = [
      t("todo2", { date: 2 }),
      t("todo1", { date: 1 }),
      t("done", { completed: [now] }),
      t("serie", { repeat: "Daily", completed: [now] }),
    ];
    const { recurring, todo } = splitUndated(list, now, 1, "UTC");
    expect(recurring.map((x) => x.id)).toEqual(["serie"]);
    expect(todo.map((x) => x.id)).toEqual(["todo1", "todo2"]);
  });
});
