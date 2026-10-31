import { describe, test, expect } from "vitest";
import {
  getNextTask,
  isTaskModified,
  getCompletionDate,
  getTasksForDay,
  upsertTaskById,
  getTime,
  returnFractedDate,
  unixToDate,
  groupTasksByTime,
  taskToCardData,
  nextGroupIndex,
  upsertTaskWithRecurrence,
  mergeMonth,
  initialMonths,
  listDays,
  nextMonthToLoad,
  monthsBetween,
} from "./functions";
import type { TaskProps } from "@/types/types";

function makeTask(over: Partial<TaskProps> = {}): TaskProps {
  return {
    id: "1",
    title: "t",
    completed: [],
    duration: "30",
    priority: 0,
    repeat: "Off",
    date: new Date(2026, 7, 1, 10, 0).getTime(),
    ...over,
  };
}

describe("getNextTask", () => {
  test("does not mutate the input array", () => {
    const a = makeTask({ id: "a", date: new Date(2026, 7, 10).getTime() });
    const b = makeTask({ id: "b", date: new Date(2026, 7, 5).getTime() });
    const input = [a, b];
    getNextTask(input);
    expect(input.map((t) => t.id)).toEqual(["a", "b"]);
  });

  test("returns the nearest future task, ignoring past ones", () => {
    const past = makeTask({ id: "past", date: Date.now() - 86_400_000 });
    const soon = makeTask({ id: "soon", date: Date.now() + 3_600_000 });
    const later = makeTask({ id: "later", date: Date.now() + 7_200_000 });
    expect(getNextTask([later, past, soon])?.id).toBe("soon");
  });

  test("returns undefined when every task is in the past", () => {
    expect(getNextTask([makeTask({ date: Date.now() - 86_400_000 })])).toBeUndefined();
  });

  test("returns undefined for an empty list", () => {
    expect(getNextTask([])).toBeUndefined();
  });
});

describe("isTaskModified", () => {
  test("returns false when nothing changed", () => {
    const t = makeTask();
    expect(isTaskModified(t, { ...t })).toBe(false);
  });

  test("detects a title change", () => {
    const t = makeTask();
    expect(isTaskModified(t, { ...t, title: "other" })).toBe(true);
  });

  test("detects a date change", () => {
    const t = makeTask();
    expect(isTaskModified(t, { ...t, date: new Date(2026, 7, 2, 10, 0).getTime() })).toBe(true);
  });

  test("does not crash when updated.alert is undefined", () => {
    const t = makeTask({ alert: new Date(2026, 7, 1, 9, 0).getTime() });
    expect(() => isTaskModified(t, { ...t, alert: undefined })).not.toThrow();
  });

  test("adicionar link conta como alteração", () => {
    const t = makeTask();
    expect(isTaskModified(t, { ...t, links: ["https://x.com"] })).toBe(true);
  });

  test("remover link conta como alteração", () => {
    const withLink = makeTask({ links: ["https://x.com"] });
    expect(isTaskModified(withLink, { ...withLink, links: undefined })).toBe(true);
  });

  // O caminho que a UI realmente produz: remover o último chip deixa `[]`, nunca `undefined`.
  test("esvaziar a lista de links conta como alteração", () => {
    const withLink = makeTask({ links: ["https://x.com"] });
    expect(isTaskModified(withLink, { ...withLink, links: [] })).toBe(true);
  });

  test("trocar a URL conta como alteração", () => {
    const t = makeTask({ links: ["https://x.com"] });
    expect(isTaskModified(t, { ...t, links: ["https://y.com"] })).toBe(true);
  });

  test("mesma lista não conta como alteração", () => {
    const t = makeTask({ links: ["https://x.com", "https://y.com"] });
    expect(isTaskModified(t, { ...t })).toBe(false);
  });

  test("sem links dos dois lados não conta como alteração", () => {
    const t = makeTask();
    expect(isTaskModified(t, { ...t })).toBe(false);
  });
});

describe("getCompletionDate", () => {
  test("true when completed on the same calendar day", () => {
    const day = new Date(2026, 7, 1, 8, 0);
    const t = makeTask({ completed: [new Date(2026, 7, 1, 22, 0).getTime()] });
    expect(getCompletionDate(t, day)).toBe(true);
  });

  test("false when completed on a different day", () => {
    const day = new Date(2026, 7, 1);
    const t = makeTask({ completed: [new Date(2026, 7, 2).getTime()] });
    expect(getCompletionDate(t, day)).toBe(false);
  });

  test("false for an empty completed array", () => {
    expect(getCompletionDate(makeTask({ completed: [] }), new Date(2026, 7, 1))).toBe(false);
  });
});

describe("getTasksForDay", () => {
  test("includes tasks on the same calendar day", () => {
    const day = new Date(2026, 7, 1);
    const t = makeTask({ id: "same", date: new Date(2026, 7, 1, 15, 0).getTime() });
    expect(getTasksForDay([t], day).map((x) => x.id)).toEqual(["same"]);
  });

  test("excludes the same day-of-month in a different month or year", () => {
    const day = new Date(2026, 7, 1);
    const otherMonth = makeTask({ id: "m", date: new Date(2026, 6, 1).getTime() });
    const otherYear = makeTask({ id: "y", date: new Date(2025, 7, 1).getTime() });
    expect(getTasksForDay([otherMonth, otherYear], day)).toEqual([]);
  });
});

describe("small date helpers", () => {
  test("returnFractedDate splits a date", () => {
    expect(returnFractedDate(new Date(2026, 7, 1))).toEqual({ day: 1, month: 8, year: 2026 });
  });

  test("getTime formats HH:MM zero-padded", () => {
    expect(getTime(new Date(2026, 7, 1, 9, 5).getTime(), "HH:MM")).toBe("09:05");
  });

  test("unixToDate converts seconds to a Date", () => {
    expect(unixToDate(0).getTime()).toBe(0);
  });
});

describe("upsertTaskById", () => {
  test("appends a new id and replaces an existing one", () => {
    const a = makeTask({ id: "a", title: "old" });
    const b = makeTask({ id: "b" });
    expect(upsertTaskById([a], b).map((t) => t.id)).toEqual(["a", "b"]);
    const out = upsertTaskById([a], makeTask({ id: "a", title: "new" }));
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("new");
  });
});

describe("groupTasksByTime", () => {
  test("groups tasks that share the same HH:MM", () => {
    const a = makeTask({ id: "a", date: new Date(2026, 7, 10, 9, 0).getTime() });
    const b = makeTask({ id: "b", date: new Date(2026, 7, 10, 9, 0).getTime() });
    const groups = groupTasksByTime([a, b]);
    expect(groups).toHaveLength(1);
    expect(groups[0].time).toBe("09:00");
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["a", "b"]);
  });

  test("orders groups chronologically regardless of input order", () => {
    const late = makeTask({ id: "late", date: new Date(2026, 7, 10, 14, 30).getTime() });
    const early = makeTask({ id: "early", date: new Date(2026, 7, 10, 9, 5).getTime() });
    const mid = makeTask({ id: "mid", date: new Date(2026, 7, 10, 11, 0).getTime() });
    expect(groupTasksByTime([late, early, mid]).map((g) => g.time)).toEqual([
      "09:05",
      "11:00",
      "14:30",
    ]);
  });

  test("sorts by minutes too, not just by hour", () => {
    const later = makeTask({ id: "later", date: new Date(2026, 7, 10, 9, 45).getTime() });
    const sooner = makeTask({ id: "sooner", date: new Date(2026, 7, 10, 9, 5).getTime() });
    expect(groupTasksByTime([later, sooner]).map((g) => g.time)).toEqual(["09:05", "09:45"]);
  });

  test("returns an empty array for no tasks", () => {
    expect(groupTasksByTime([])).toEqual([]);
  });

  test("does not mutate the input array", () => {
    const a = makeTask({ id: "a", date: new Date(2026, 7, 10, 14, 0).getTime() });
    const b = makeTask({ id: "b", date: new Date(2026, 7, 10, 8, 0).getTime() });
    const input = [a, b];
    groupTasksByTime(input);
    expect(input.map((t) => t.id)).toEqual(["a", "b"]);
  });
});

describe("taskToCardData", () => {
  const day = new Date(2026, 7, 10);

  test("maps the card fields off the task", () => {
    const task = makeTask({
      title: "Revisar PRs",
      duration: "45min",
      priority: 3,
      tags: ["dev", "review"],
      links: ["https://github.com/org/repo/pull/1"],
      repeat: { Weekly: ["Monday"] },
      date: new Date(2026, 7, 10, 8, 30).getTime(),
    });
    expect(taskToCardData(task, day)).toEqual({
      time: "08:30",
      title: "Revisar PRs",
      duration: "45min",
      tags: ["dev", "review"],
      priority: 3,
      completed: false,
      links: ["https://github.com/org/repo/pull/1"],
      repeat: "Seg",
    });
  });

  test("missing tags become an empty array, never undefined", () => {
    const task = makeTask({ tags: undefined });
    expect(taskToCardData(task, day).tags).toEqual([]);
  });

  test("completed is true only when the task was completed on THAT day", () => {
    const onDay = makeTask({ completed: [new Date(2026, 7, 10, 18, 0).getTime()] });
    const otherDay = makeTask({ completed: [new Date(2026, 7, 9, 18, 0).getTime()] });
    expect(taskToCardData(onDay, day).completed).toBe(true);
    expect(taskToCardData(otherDay, day).completed).toBe(false);
  });

  test("completed is false (never undefined) for an empty completed list", () => {
    expect(taskToCardData(makeTask({ completed: [] }), day).completed).toBe(false);
  });
});

describe("nextGroupIndex", () => {
  const at = (h: number, m: number) => new Date(2026, 7, 10, h, m);
  const groups = [{ time: "09:00" }, { time: "11:00" }, { time: "14:30" }];

  test("0 when nothing has started yet", () => {
    expect(nextGroupIndex(groups, at(7, 0))).toBe(0);
  });

  test("the first group still ahead", () => {
    expect(nextGroupIndex(groups, at(10, 0))).toBe(1);
    expect(nextGroupIndex(groups, at(12, 0))).toBe(2);
  });

  test("-1 when the whole day is behind — everything on screen is past", () => {
    expect(nextGroupIndex(groups, at(18, 0))).toBe(-1);
  });

  test("a group starting exactly now is the next one, not a past one", () => {
    expect(nextGroupIndex(groups, at(11, 0))).toBe(1);
  });

  test("-1 on an empty day", () => {
    expect(nextGroupIndex([], at(12, 0))).toBe(-1);
  });
});

describe("upsertTaskWithRecurrence", () => {
  const month = [new Date(2026, 7, 1)];
  const daily = makeTask({ id: "r", repeat: "Daily", date: new Date(2026, 7, 1, 9, 0).getTime() });

  test("virar diária cria as instâncias do mês na hora", () => {
    const before = makeTask({ id: "r", date: daily.date });
    const next = upsertTaskWithRecurrence([before], daily, month);
    expect(next.length).toBe(31); // a original + os 30 dias que sobram de agosto
  });

  test("voltar pra 'não repetir' leva as instâncias junto", () => {
    const expanded = upsertTaskWithRecurrence([daily], daily, month);
    const off = makeTask({ id: "r", repeat: "Off", date: daily.date });
    expect(upsertTaskWithRecurrence(expanded, off, month)).toEqual([off]);
  });

  test("editar uma recorrente atinge TODAS as instâncias, não só a primeira", () => {
    const expanded = upsertTaskWithRecurrence([daily], daily, month);
    const renamed = { ...daily, title: "novo" };
    const next = upsertTaskWithRecurrence(expanded, renamed, month);
    expect(next.every((t) => t.title === "novo")).toBe(true);
  });

  test("não mexe nas outras tarefas", () => {
    const other = makeTask({ id: "outra" });
    const next = upsertTaskWithRecurrence([other, daily], { ...daily, repeat: "Off" }, month);
    expect(next.filter((t) => t.id === "outra")).toEqual([other]);
  });

  test("reconstrói as instâncias em todos os meses carregados", () => {
    const next = upsertTaskWithRecurrence([], daily, [new Date(2026, 7, 1), new Date(2026, 8, 1)]);
    expect(next.length).toBe(61); // a original + 30 de agosto + 30 de setembro
    expect(next.filter((t) => new Date(t.date).getMonth() === 8).length).toBe(30);
  });
});

describe("initialMonths", () => {
  test("concluir uma recorrente antes da 1ª leitura mantém as instâncias dos dois meses", () => {
    const daily = makeTask({ id: "r", repeat: "Daily", date: new Date(2026, 7, 1, 9).getTime() });
    const months = initialMonths(new Date(2026, 7, 31, 23));
    expect(months).toEqual([new Date(2026, 7, 1), new Date(2026, 8, 1)]);
    expect(upsertTaskWithRecurrence([daily], daily, months).length).toBe(61);
  });
});

describe("mergeMonth", () => {
  const aug = new Date(2026, 7, 1);
  const inAug = makeTask({ id: "a", date: new Date(2026, 7, 10).getTime() });
  const inSep = makeTask({ id: "s", date: new Date(2026, 8, 10).getTime() });

  test("troca só as tarefas do mês buscado", () => {
    const fresh = makeTask({ id: "n", date: new Date(2026, 7, 20).getTime() });
    expect(mergeMonth([inAug, inSep], aug, [fresh])).toEqual([inSep, fresh]);
  });

  test("recorrente em dois meses: recarregar um não apaga as instâncias do outro", () => {
    const daily = makeTask({ id: "r", repeat: "Daily", date: new Date(2026, 7, 31, 9).getTime() });
    const sepInstance = { ...daily, date: new Date(2026, 8, 1, 9).getTime() };
    const merged = mergeMonth([daily, sepInstance], aug, [{ ...daily, title: "novo" }]);
    expect(merged).toEqual([sepInstance, { ...daily, title: "novo" }]);
  });

  test("mês vazio no servidor esvazia só aquele mês", () => {
    expect(mergeMonth([inAug, inSep], aug, [])).toEqual([inSep]);
  });
});

describe("listDays", () => {
  const start = new Date(2026, 7, 10);
  const end = new Date(2026, 8, 30);
  const at = (m: number, d: number) => makeTask({ date: new Date(2026, m, d, 9).getTime() });

  test("só dias com tarefa, atravessando meses, em ordem", () => {
    const days = listDays({ start, end, tasks: [at(8, 5), at(7, 12), at(7, 12)] });
    expect(days).toEqual([new Date(2026, 7, 12), new Date(2026, 8, 5)]);
  });

  test("o início entra sem tarefa quando pedido; dias extras também, sem duplicar", () => {
    const days = listDays({
      start,
      end,
      tasks: [at(7, 20)],
      keepStart: true,
      extra: [new Date(2026, 7, 15, 13), new Date(2026, 7, 20)],
    });
    expect(days).toEqual([new Date(2026, 7, 10), new Date(2026, 7, 15), new Date(2026, 7, 20)]);
  });

  test("extra fora do intervalo é ignorado", () => {
    expect(listDays({ start, end, tasks: [], extra: [new Date(2026, 7, 1)] })).toEqual([]);
  });
});

describe("nextMonthToLoad", () => {
  const m = (i: number) => new Date(2026, i, 1);

  test("pula o trecho contíguo e para no primeiro buraco", () => {
    expect(nextMonthToLoad([m(9), m(10), m(0)], new Date(2026, 9, 31))).toEqual(m(11));
  });

  test("se o mês do início nem foi carregado, é ele", () => {
    expect(nextMonthToLoad([m(10)], new Date(2026, 9, 5))).toEqual(m(9));
  });
});

describe("monthsBetween", () => {
  test("do mês de from ao de to, inclusive; no mesmo mês, só ele", () => {
    const months = monthsBetween(new Date(2026, 0, 20), new Date(2026, 3, 2));
    expect(months).toEqual([0, 1, 2, 3].map((m) => new Date(2026, m, 1)));
    expect(monthsBetween(new Date(2026, 5, 9), new Date(2026, 5, 20))).toHaveLength(1);
  });
});

describe("monthsBetween (dia passado)", () => {
  test("de um dia passado até hoje cobre todos os meses do meio", () => {
    expect(monthsBetween(new Date(2026, 7, 15), new Date(2026, 9, 31))).toHaveLength(3);
  });
});
