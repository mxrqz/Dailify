/** @vitest-environment jsdom */
import { describe, test, expect, vi, afterEach } from "vitest";

const api = vi.hoisted(() => ({
  createTask: vi.fn(),
  updateTask: vi.fn(),
  completeTask: vi.fn(),
  uncompleteTask: vi.fn(),
  uncompleteTaskRange: vi.fn(),
  deleteTask: vi.fn(),
}));
vi.mock("./api", () => api);

import { saveChat } from "@/components/mew-chat/thread";
import {
  cacheTasks,
  cacheUndated,
  clearLocal,
  collapseQueue,
  dequeue,
  enqueue,
  flushQueue,
  readQueue,
  rememberUser,
  shouldQueue,
  type Mutation,
} from "./offline";
import { setAppTimeZone } from "./zone";

describe("shouldQueue", () => {
  test("queues offline and 401 errors, nothing else", () => {
    expect(shouldQueue({ message: "", offline: true })).toBe(true);
    expect(shouldQueue({ message: "", offline: false, status: 401 })).toBe(true);
    expect(shouldQueue({ message: "", offline: false, status: 500 })).toBe(false);
    expect(shouldQueue(undefined)).toBe(false);
  });
});

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

  test("keeps an occurrence edit apart from the series edit", () => {
    const occurrence: Mutation = {
      op: "patch",
      taskId: "a",
      patch: { date: 5 },
      at: 3,
      occurrence: 1,
    };
    const out = collapseQueue([patch("a", { title: "série" }), occurrence]);
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ patch: { date: 5 }, occurrence: 1 });
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

  test("checks on different days of a series don't cancel each other", () => {
    setAppTimeZone("UTC");
    const monday = Date.UTC(2026, 10, 16, 10);
    const tuesday = Date.UTC(2026, 10, 17, 10);
    const queue: Mutation[] = [
      { op: "complete", taskId: "a", at: monday },
      { op: "uncomplete", taskId: "a", day: Date.UTC(2026, 10, 17), at: tuesday },
    ];
    expect(collapseQueue(queue)).toEqual(queue);
    setAppTimeZone(null);
  });

  test("an undated uncomplete cancels a pending complete inside its period", () => {
    const uncomplete: Mutation = { op: "uncomplete", taskId: "a", day: 0, until: 500, at: 500 };
    expect(collapseQueue([{ op: "complete", taskId: "a", at: 400 }, uncomplete])).toEqual([
      uncomplete,
    ]);
  });

  test("a delete does not touch another task's pending work", () => {
    const out = collapseQueue([patch("a", { title: "x" }), { op: "delete", taskId: "b", at: 5 }]);
    expect(out.map((m) => `${m.op}:${m.taskId}`)).toEqual(["patch:a", "delete:b"]);
  });
});

describe("delete-occurrence", () => {
  const removeOccurrence = (taskId: string, occurrence: number, at = 5): Mutation => ({
    op: "delete-occurrence",
    taskId,
    occurrence,
    at,
  });

  // O motivo de ser uma op própria: como `delete`, ela engoliria os patches pendentes da série.
  test("não engole as outras mutações da mesma tarefa", () => {
    const queue = [patch("a", { title: "novo" }), removeOccurrence("a", 111)];
    expect(collapseQueue(queue).map((m) => m.op)).toEqual(["patch", "delete-occurrence"]);
  });

  test("excluir a série descarta a exclusão de ocorrência pendente", () => {
    const queue: Mutation[] = [removeOccurrence("a", 111), { op: "delete", taskId: "a", at: 6 }];
    expect(collapseQueue(queue)).toEqual([{ op: "delete", taskId: "a", at: 6 }]);
  });

  test("duas ocorrências diferentes continuam sendo duas", () => {
    const queue = [removeOccurrence("a", 111), removeOccurrence("a", 222)];
    expect(collapseQueue(queue)).toHaveLength(2);
  });
});

describe("flushQueue", () => {
  afterEach(() => {
    localStorage.clear();
    vi.resetAllMocks();
  });

  test("uncomplete com until sobe como intervalo", async () => {
    api.uncompleteTaskRange.mockResolvedValue({});
    enqueue("u", { op: "uncomplete", taskId: "a", day: 100, until: 200, at: 200 });

    await expect(flushQueue("u")).resolves.toEqual({ sent: 1, dropped: 0, offline: false });
    expect(api.uncompleteTaskRange).toHaveBeenCalledWith("a", 100, 200);
    expect(api.uncompleteTask).not.toHaveBeenCalled();
    expect(readQueue("u")).toEqual([]);
  });

  test("dequeue takes back a pending entry, but not once a flush has it", async () => {
    api.deleteTask.mockResolvedValue({});
    const mutation: Mutation = { op: "delete-occurrence", taskId: "a", occurrence: 1, at: 1 };
    enqueue("u", mutation);
    expect(dequeue("u", mutation)).toBe(true);
    expect(readQueue("u")).toEqual([]);

    enqueue("u", mutation);
    const flush = flushQueue("u");
    expect(dequeue("u", mutation)).toBe(false);
    await flush;
    expect(api.deleteTask).toHaveBeenCalledWith("a", 1);
    expect(dequeue("u", mutation)).toBe(false);
  });

  test("duas chamadas juntas sobem a fila uma vez só", async () => {
    api.completeTask.mockResolvedValue({});
    enqueue("u", { op: "complete", taskId: "a", at: 1 });

    const [first, second] = await Promise.all([flushQueue("u"), flushQueue("u")]);
    expect(first).toBe(second);
    expect(api.completeTask).toHaveBeenCalledTimes(1);
  });

  test("o que entra durante a subida sobe junto, sem se perder", async () => {
    api.completeTask.mockResolvedValue({}).mockImplementationOnce(async () => {
      enqueue("u", { op: "complete", taskId: "b", at: 2 });
      return {};
    });
    enqueue("u", { op: "complete", taskId: "a", at: 1 });

    await expect(flushQueue("u")).resolves.toMatchObject({ sent: 2, offline: false });
    expect(api.completeTask.mock.calls.map((c) => c[0])).toEqual(["a", "b"]);
    expect(readQueue("u")).toEqual([]);
  });

  test("excluir durante a subida da criação não some com a exclusão", async () => {
    api.createTask.mockImplementationOnce(async () => {
      enqueue("u", { op: "delete", taskId: "a", at: 5 });
      return {};
    });
    api.deleteTask.mockResolvedValue({});
    enqueue("u", create("a"));

    await flushQueue("u");
    expect(api.deleteTask).toHaveBeenCalledWith("a", undefined, 5);
    expect(readQueue("u")).toEqual([]);
  });

  test("servidor recusa a cabeça enquanto outra aba já a tirou: não leva a seguinte", async () => {
    api.completeTask
      .mockImplementationOnce(async () => {
        localStorage.setItem("dailify:outbox:u", JSON.stringify([readQueue("u")[1]]));
        return { error: { message: "não existe", offline: false } };
      })
      .mockResolvedValueOnce({ error: { message: "rede", offline: true } });
    enqueue("u", { op: "complete", taskId: "a", at: 1 });
    enqueue("u", { op: "complete", taskId: "b", at: 2 });

    await flushQueue("u");
    expect(readQueue("u").map((m) => m.taskId)).toEqual(["b"]);
  });

  test("rede cai no meio da subida: o que não subiu continua na fila", async () => {
    api.completeTask
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ error: { message: "rede", offline: true } });
    enqueue("u", { op: "complete", taskId: "a", at: 1 });
    enqueue("u", { op: "complete", taskId: "b", at: 2 });
    enqueue("u", { op: "complete", taskId: "c", at: 3 });

    await expect(flushQueue("u")).resolves.toEqual({ sent: 1, dropped: 0, offline: true });
    expect(readQueue("u").map((m) => m.taskId)).toEqual(["b", "c"]);
  });

  // Sessão caída (aba velha na troca de conta) não é recusa da edição: descartar perderia o trabalho.
  test("401 mantém a entrada na fila, como rede", async () => {
    api.completeTask.mockResolvedValueOnce({
      error: { message: "não autenticado", offline: false, status: 401 },
    });
    enqueue("u", { op: "complete", taskId: "a", at: 1 });

    await expect(flushQueue("u")).resolves.toEqual({ sent: 0, dropped: 0, offline: true });
    expect(readQueue("u").map((m) => m.taskId)).toEqual(["a"]);
  });

  test("patch com alert: null dobrado na criação vira criação sem lembrete", () => {
    const out = collapseQueue([
      { op: "create", taskId: "a", input: { ...input, alert: 5 }, at: 1 },
      { op: "patch", taskId: "a", patch: { alert: null }, at: 2 },
    ]);
    expect(out[0]).toMatchObject({ op: "create" });
    expect(out[0].op === "create" && out[0].input.alert).toBeUndefined();
  });
});

describe("clearLocal", () => {
  test("não deixa no aparelho nenhuma chave do usuário excluído", () => {
    localStorage.clear();
    cacheTasks("u-gone", []);
    cacheUndated("u-gone", []);
    enqueue("u-gone", create("t1"));
    rememberUser({ id: "u-gone", name: "", email: "a@b.c" });
    saveChat("u-gone", [{ id: "m1", from: "me", text: "oi" }]);
    cacheTasks("u-other", []);
    clearLocal("u-gone");
    const keys = Object.keys(localStorage);
    expect(keys.filter((k) => k.includes("u-gone") || k === "dailify:last-user")).toEqual([]);
    expect(keys).toContain("dailify:tasks:u-other");
  });
});
