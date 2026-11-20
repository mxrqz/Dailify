/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import type { SetStateAction } from "react";
import { toast } from "sonner";
import type { Task } from "@dailify/shared";

const { dailify, api } = vi.hoisted(() => ({
  dailify: vi.fn(),
  api: {
    completeTask: vi.fn(),
    uncompleteTask: vi.fn(),
    createTask: vi.fn(),
    deleteTask: vi.fn(),
    updateTask: vi.fn(),
  },
}));
vi.mock("@/components/dailifyContext", () => ({ useDailify: dailify }));
vi.mock("@/lib/auth", () => ({
  useSession: () => ({ data: { user: { id: "u1" } }, isPending: false }),
}));
vi.mock("@/functions/api", () => api);

import { Toaster } from "@/components/ui/sonner";
import { copy } from "@/components/dashboard/copy";
import { getCompletionDate, upsertTaskWithRecurrence } from "@/functions/functions";
import { readQueue } from "@/functions/offline";
import { zoned } from "@/functions/zone";
import { useTaskActions } from "./useTaskActions";

const AUG = new Date(2026, 7, 1);
const anchor: Task = {
  id: "r",
  title: "Remédio",
  date: new Date(2026, 7, 1, 9).getTime(),
  duration: "",
  priority: 0,
  repeat: "Daily",
  completed: [],
};
const series = upsertTaskWithRecurrence([], anchor, [AUG]);
const day18 = series.find((t) => new Date(t.date).getDate() === 18);
const HOUR = 3_600_000;

// The real provider passes useState setters: a functional update reads the list of the moment.
let store: Task[] = [];
const setTasks = vi.fn((next: SetStateAction<Task[] | undefined>) => {
  store = (typeof next === "function" ? next(store) : next) ?? [];
});

beforeEach(() => {
  dailify.mockImplementation(() => ({ tasks: store, setTasks, loadedMonths: [AUG] }));
});
afterEach(() => {
  localStorage.clear();
  toast.dismiss();
});

function Delete({ task }: { task: Task }) {
  const { onDelete, deleteDialog } = useTaskActions(task);
  return (
    <>
      <button onClick={() => void onDelete()}>excluir</button>
      {deleteDialog}
    </>
  );
}

describe("useTaskActions", () => {
  it("a series move from an instance shifts the anchor instead of re-anchoring on the instance", async () => {
    if (!day18) throw new Error("no day 18");
    store = series;
    api.updateTask.mockResolvedValue({ error: { message: "rede", offline: true } });
    const { result } = renderHook(() => useTaskActions(day18));

    await act(() => result.current.onPatch({ date: day18.date + HOUR }));

    expect(api.updateTask.mock.calls[0][1]).toMatchObject({ date: anchor.date + HOUR });
    expect(store).toHaveLength(31);
    expect(store.some((t) => t.date === anchor.date + HOUR && t.seriesStart === undefined)).toBe(
      true,
    );
  });

  it("undo after deleting a whole series from an instance re-creates it from the anchor", async () => {
    if (!day18) throw new Error("no day 18");
    store = series;
    api.deleteTask.mockResolvedValue({});
    api.createTask.mockResolvedValue({});
    render(<Toaster />);
    render(<Delete task={day18} />);

    await act(async () => screen.getByRole("button", { name: "excluir" }).click());
    await act(async () =>
      (await screen.findByRole("button", { name: copy.form.scopeSeries })).click(),
    );
    await act(async () => (await screen.findByRole("button", { name: copy.task.undo })).click());

    expect(api.createTask.mock.calls[0][0]).toMatchObject({ id: "r", date: anchor.date });
    expect(api.createTask.mock.calls[0][0]).not.toHaveProperty("seriesStart");
    expect(store).toHaveLength(31);
  });

  it("an occurrence delete is queued at once and Undo takes it back without sending it", async () => {
    if (!day18) throw new Error("no day 18");
    store = series;
    api.deleteTask.mockResolvedValue({});
    render(<Toaster />);
    render(<Delete task={day18} />);

    await act(async () => screen.getByRole("button", { name: "excluir" }).click());
    await act(async () =>
      (await screen.findByRole("button", { name: copy.form.scopeOccurrence })).click(),
    );
    expect(store).toHaveLength(30);
    expect(readQueue("u1")).toMatchObject([{ op: "delete-occurrence", occurrence: day18.date }]);
    await act(async () => (await screen.findByRole("button", { name: copy.task.undo })).click());

    expect(store).toHaveLength(31);
    expect(readQueue("u1")).toEqual([]);
    expect(api.deleteTask).not.toHaveBeenCalled();
  });

  it("an occurrence delete is sent once its toast closes", async () => {
    if (!day18) throw new Error("no day 18");
    store = series;
    api.deleteTask.mockResolvedValue({});
    render(<Toaster />);
    render(<Delete task={day18} />);

    await act(async () => screen.getByRole("button", { name: "excluir" }).click());
    await act(async () =>
      (await screen.findByRole("button", { name: copy.form.scopeOccurrence })).click(),
    );
    await screen.findByRole("button", { name: copy.task.undo });
    await act(async () => void toast.dismiss());

    await vi.waitFor(() => expect(api.deleteTask).toHaveBeenCalledWith("r", day18.date));
    expect(store).toHaveLength(30);
    expect(readQueue("u1")).toEqual([]);
  });

  it("undo of a delete keeps a write to another task that landed meanwhile", async () => {
    const a: Task = { ...anchor, id: "a", repeat: "Off" };
    const b: Task = { ...anchor, id: "b", repeat: "Off" };
    store = [a, b];
    api.deleteTask.mockResolvedValue({});
    api.createTask.mockResolvedValue({});
    render(<Toaster />);
    render(<Delete task={a} />);

    await act(async () => screen.getByRole("button", { name: "excluir" }).click());
    act(() =>
      setTasks((cur) => (cur ?? []).map((t) => (t.id === "b" ? { ...t, completed: [1] } : t))),
    );
    await act(async () => (await screen.findByRole("button", { name: copy.task.undo })).click());

    expect(store.find((t) => t.id === "b")?.completed).toEqual([1]);
    expect(store.some((t) => t.id === "a")).toBe(true);
  });

  it("completing another day's occurrence offline stamps that day, queues it and keeps the series", async () => {
    if (!day18) throw new Error("no day 18");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 7, 10, 12));
    store = series;
    api.completeTask.mockResolvedValue({ error: { message: "rede", offline: true } });
    const { result } = renderHook(() => useTaskActions(day18, zoned(day18.date)));

    await act(() => result.current.onComplete());
    vi.useRealTimers();

    expect(api.completeTask).toHaveBeenCalledWith("r", day18.date);
    expect(readQueue("u1")).toEqual([{ op: "complete", taskId: "r", at: day18.date }]);
    expect(store).toHaveLength(31);
    expect(
      store.every((t) => getCompletionDate(t, zoned(t.date)) === (t.date === day18.date)),
    ).toBe(true);
  });

  it("a refused write rolls back only its own task", async () => {
    const a: Task = { ...anchor, id: "a", repeat: "Off" };
    const b: Task = { ...anchor, id: "b", repeat: "Off" };
    store = [a, b];
    let refuse: (value: unknown) => void = () => {};
    api.completeTask.mockReturnValue(new Promise((resolve) => (refuse = resolve)));
    const { result } = renderHook(() => useTaskActions(a));

    let done: Promise<void> = Promise.resolve();
    act(() => {
      done = result.current.onComplete();
    });
    act(() =>
      setTasks((cur) => (cur ?? []).map((t) => (t.id === "b" ? { ...t, title: "new" } : t))),
    );
    await act(async () => {
      refuse({ error: { message: "nope", offline: false } });
      await done;
    });

    expect(store.find((t) => t.id === "a")?.completed).toEqual([]);
    expect(store.find((t) => t.id === "b")?.title).toBe("new");
  });
});
