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
import { readQueue } from "@/functions/offline";
import { zoned } from "@/functions/zone";
import { useCreateTask, useShowCreated } from "./useCreateTask";

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
  vi.clearAllMocks();
  localStorage.clear();
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
  it("offers the upgrade only on the quota response", async () => {
    const { result } = renderHook(() => useCreateTask(), { wrapper });
    const parsed = parseTaskText("x", zoned());

    api.createTask.mockResolvedValueOnce({ error: { message: "bad", status: 400 } });
    await act(() => result.current.create(parsed));
    api.createTask.mockResolvedValueOnce({ error: { message: "quota", status: 429 } });
    await act(() => result.current.create(parsed));

    expect(toast.error.mock.calls[0][1].action).toBeUndefined();
    expect(toast.error.mock.calls[1][1].action.label).toBe(copy.form.upgrade);
  });
});
