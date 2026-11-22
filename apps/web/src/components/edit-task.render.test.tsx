/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Task } from "@dailify/shared";

const { dailify, api } = vi.hoisted(() => ({
  dailify: vi.fn(),
  api: { updateTask: vi.fn() },
}));
vi.mock("@/components/dailifyContext", () => ({ useDailify: dailify }));
vi.mock("@/lib/auth", () => ({
  useSession: () => ({ data: { user: { id: "u1" } }, isPending: false }),
}));
vi.mock("@/functions/api", () => api);
// O formulário de verdade é coberto no próprio teste; aqui só interessa o que salvar faz.
vi.mock("@/components/dashboard/task-form", () => ({
  FORM_VIEWS: {},
  TaskForm: ({ id, onSubmit }: { id: string; onSubmit: (values: unknown) => void }) => (
    <form
      id={id}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ ...values, ...form, title: "Dentista às 16h" });
      }}
    />
  ),
}));

import { EditTask, EditTaskContent } from "./edit-task";
import { flushQueue, readQueue } from "@/functions/offline";
import { copy } from "@/components/dashboard/copy";
import { upsertTaskWithRecurrence } from "@/functions/functions";

const task: Task = {
  id: "t",
  title: "Dentista",
  date: new Date(2026, 9, 23, 15).getTime(),
  duration: "1h",
  priority: 0,
  repeat: "Off",
  completed: [],
};
const values = {
  title: task.title,
  date: new Date(task.date),
  duration: task.duration,
  priority: 0,
  repeat: "Off",
  repeatEvery: 1,
  undated: false,
};
// What the form submits on top of `values`: the real form starts from the tapped task.
let form: Partial<typeof values & { before: number }> = {};

describe("<EditTaskContent> offline", () => {
  it("edição sem rede entra na fila e sobe como PATCH com a hora da edição", async () => {
    const setTasks = vi.fn();
    dailify.mockReturnValue({
      tasks: [task],
      setTasks,
      setUndatedTasks: vi.fn(),
      loadedMonths: [new Date(task.date)],
    });
    api.updateTask.mockResolvedValueOnce({ error: { message: "rede", offline: true } });

    render(
      <MemoryRouter>
        <EditTask open>
          <EditTaskContent task={task} day={new Date(task.date)} open onClose={vi.fn()} />
        </EditTask>
      </MemoryRouter>,
    );
    const form = document.querySelector("form");
    if (form) fireEvent.submit(form);

    await waitFor(() => expect(readQueue("u1")).toHaveLength(1));
    const [queued] = readQueue("u1");
    expect(queued).toMatchObject({ op: "patch", taskId: "t", patch: { title: "Dentista às 16h" } });
    expect(queued.op === "patch" && queued.patch.updatedAt).toBe(queued.at);
    // Otimista: a tela já mostra a edição.
    expect(setTasks).toHaveBeenCalled();

    api.updateTask.mockResolvedValueOnce({});
    await expect(flushQueue("u1")).resolves.toMatchObject({ sent: 1, offline: false });
    expect(api.updateTask).toHaveBeenLastCalledWith(
      "t",
      expect.objectContaining({ title: "Dentista às 16h", updatedAt: queued.at }),
      undefined,
    );
    expect(readQueue("u1")).toEqual([]);
  });
});

describe("<EditTaskContent> preguiçosa", () => {
  it("fechada não monta; depois do primeiro open fica montada pra animar a saída", () => {
    dailify.mockClear();
    dailify.mockReturnValue({ tasks: [task], setTasks: vi.fn(), loadedMonths: [] });
    const sheet = (open: boolean) => (
      <MemoryRouter>
        <EditTask open={open}>
          <EditTaskContent task={task} day={new Date(task.date)} open={open} onClose={vi.fn()} />
        </EditTask>
      </MemoryRouter>
    );
    const { rerender } = render(sheet(false));
    expect(dailify).not.toHaveBeenCalled();
    rerender(sheet(true));
    expect(dailify).toHaveBeenCalled();
    dailify.mockClear();
    rerender(sheet(false));
    expect(dailify).toHaveBeenCalled();
  });
});

describe("<EditTaskContent> series", () => {
  it("a whole-series edit from a later instance keeps the series anchor and its reminder", async () => {
    const anchor: Task = { ...task, repeat: "Daily", alert: task.date - 30 * 60_000 };
    const month = new Date(2026, 9, 1);
    const instance = upsertTaskWithRecurrence([], anchor, [month]).find(
      (t) => new Date(t.date).getDate() === 30,
    );
    if (!instance) throw new Error("no instance");
    form = { date: new Date(instance.date), repeat: "Daily", before: 30 };
    dailify.mockReturnValue({
      tasks: [],
      setTasks: vi.fn(),
      setUndatedTasks: vi.fn(),
      loadedMonths: [month],
    });
    api.updateTask.mockResolvedValueOnce({ error: { message: "rede", offline: true } });

    render(
      <MemoryRouter>
        <EditTask open>
          <EditTaskContent task={instance} day={new Date(instance.date)} open onClose={vi.fn()} />
        </EditTask>
      </MemoryRouter>,
    );
    const sheet = document.querySelector("form");
    if (sheet) fireEvent.submit(sheet);
    await act(async () =>
      (await screen.findByRole("button", { name: copy.form.scopeSeries })).click(),
    );

    await waitFor(() => expect(api.updateTask).toHaveBeenCalled());
    expect(api.updateTask.mock.lastCall?.[1]).toMatchObject({
      date: anchor.date,
      alert: anchor.alert,
    });
    form = {};
  });
});
