/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode, SetStateAction } from "react";
import { MemoryRouter } from "react-router-dom";
import { parseTaskText, type Task } from "@dailify/shared";

const api = vi.hoisted(() => ({
  createTask: vi.fn(),
  deleteTask: vi.fn(),
  createCalendarEvent: vi.fn(),
}));
const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), message: vi.fn() }),
);
vi.mock("@/functions/api", () => api);
vi.mock("sonner", () => ({ toast }));
vi.mock("@/lib/auth", () => ({
  useSession: () => ({ data: { user: { id: "u1" } }, isPending: false }),
}));

let tasks: Task[] = [];
let undated: Task[] = [];
const apply =
  (get: () => Task[], set: (v: Task[]) => void) => (next: SetStateAction<Task[] | undefined>) =>
    set((typeof next === "function" ? next(get()) : next) ?? []);
vi.mock("@/components/dailifyContext", () => ({
  useDailify: () => ({
    setTasks: apply(
      () => tasks,
      (v) => (tasks = v),
    ),
    setUndatedTasks: apply(
      () => undated,
      (v) => (undated = v),
    ),
    loadedMonths: [],
    bumpUsage: vi.fn(),
    quotas: undefined,
  }),
}));

import { copy } from "@/components/dashboard/copy";
import { clearLocal, readQueue } from "@/functions/offline";
import { zoned } from "@/functions/zone";
import { isSaving, useCreateTask, useShowCreated } from "./useCreateTask";

const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;
const task = (id: string): Task => ({
  id,
  title: id,
  date: 0,
  duration: "",
  priority: 0,
  repeat: "Off",
  completed: [],
  undated: true,
});

afterEach(() => {
  clearLocal("u1");
  tasks = [];
  undated = [];
});

describe("useShowCreated", () => {
  it("undo queues an offline delete and puts back a refused one", async () => {
    const { result } = renderHook(() => useShowCreated(), { wrapper });
    act(() => result.current([task("a"), task("b")], "ok"));
    api.deleteTask.mockImplementation(async (id: string) => ({
      error: id === "a" ? { message: "rede", offline: true } : { message: "nope", status: 500 },
    }));

    const undo = toast.success.mock.calls[0][1].action.onClick;
    await act(async () => {
      undo();
      await vi.waitFor(() => expect(toast.error).toHaveBeenCalled());
    });

    expect(readQueue("u1")).toMatchObject([{ op: "delete", taskId: "a" }]);
    expect(undated.map((t) => t.id)).toEqual(["b"]);
    expect(toast.error).toHaveBeenCalledWith(copy.task.deleteError, { description: "nope" });
  });
});

describe("useCreateTask", () => {
  it("rolls back a refused create and shows the server's message", async () => {
    const { result } = renderHook(() => useCreateTask(), { wrapper });
    api.createTask.mockResolvedValueOnce({ error: { message: "slow down", status: 429 } });

    let ok = true;
    await act(async () => void (ok = await result.current.create(parseTaskText("x", zoned()))));

    expect(ok).toBe(false);
    expect([...tasks, ...undated]).toEqual([]);
    expect(toast.error).toHaveBeenCalledWith(copy.form.createError, { description: "slow down" });
  });

  it("marks the optimistic task as saving until the server's copy replaces it", async () => {
    const { result } = renderHook(() => useCreateTask(), { wrapper });
    let reply: (value: { task: Task }) => void = () => {};
    api.createTask.mockReturnValueOnce(new Promise((resolve) => (reply = resolve)));

    let created: Promise<boolean> = Promise.resolve(false);
    act(() => void (created = result.current.create(parseTaskText("x amanhã às 10h", zoned()))));
    const [optimistic] = tasks;
    expect(isSaving(optimistic)).toBe(true);

    await act(async () => {
      reply({ task: { ...optimistic } });
      await created;
    });
    expect(tasks).toHaveLength(1);
    expect(isSaving(tasks[0])).toBe(false);
  });

  it("sets a dated task's alert from the reminder offset, and leaves an undated one's alone", async () => {
    const { result } = renderHook(() => useCreateTask(), { wrapper });
    api.createTask.mockResolvedValue({ error: { message: "nope", status: 500 } });
    const create = (text: string) =>
      result.current.create(parseTaskText(text, zoned()), { before: 30 });

    await act(async () => void (await create("x amanhã às 10h")));
    const dated = api.createTask.mock.lastCall?.[0];
    expect(dated.alert).toBe(dated.date - 30 * 60_000);

    await act(async () => void (await create("x amanhã")));
    const day = api.createTask.mock.lastCall?.[0];
    expect(day.undated).toBe(true);
    expect(day.alert).toBe(day.date);
  });
});
