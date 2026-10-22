/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Task } from "@dailify/shared";

const { dailify, api } = vi.hoisted(() => ({
  dailify: vi.fn(),
  api: {
    completeTask: vi.fn(),
    uncompleteTaskRange: vi.fn(),
    deleteTask: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
  },
}));
vi.mock("@/components/dailifyContext", () => ({ useDailify: dailify }));
vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({ getToken: async () => "token", userId: "u1" }),
  useUser: () => ({ user: { id: "u1" } }),
}));
vi.mock("@/functions/api", () => api);

import { copy } from "./copy";
import { CheckHistory } from "./check-history";
import { UndatedList } from "./undated-list";
import { useUndatedActions } from "@/hooks/useUndatedActions";

// Sexta, 23/out/2026 12:00 local; semana começa na segunda (19/out 06:00).
const FRIDAY = new Date(2026, 9, 23, 12).getTime();
const MONDAY = new Date(2026, 9, 19, 10).getTime();
const MONDAY_6H = new Date(2026, 9, 19, 6).getTime();
const WEEK = 7 * 24 * 60 * 60 * 1000;

const task = (patch: Partial<Task>): Task => ({
  id: "t",
  title: "Tarefa",
  date: MONDAY - 10 * WEEK,
  duration: "",
  priority: 0,
  repeat: "Off",
  completed: [],
  undated: true,
  ...patch,
});

const context = (undatedTasks: Task[] | undefined) => {
  const setUndatedTasks = vi.fn();
  dailify.mockReturnValue({
    undatedTasks,
    setUndatedTasks,
    weekStart: 1,
    tasks: [],
    setTasks: vi.fn(),
    bumpUsage: vi.fn(),
    selectedDay: new Date(FRIDAY),
    quotas: undefined,
  });
  return setUndatedTasks;
};

const renderList = (undatedTasks: Task[] | undefined) => {
  context(undatedTasks);
  return render(
    <MemoryRouter>
      <UndatedList />
    </MemoryRouter>,
  );
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FRIDAY);
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("<UndatedList>", () => {
  it("série marcada nesta semana aparece marcada", () => {
    renderList([
      task({
        id: "a",
        title: "Regar as plantas",
        repeat: { Weekly: ["Monday"] },
        completed: [MONDAY],
      }),
    ]);

    expect(screen.getByRole("checkbox", { name: copy.task.uncomplete })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByText(copy.undated.doneWeekly)).toBeInTheDocument();
    expect(screen.getByText(copy.undated.recurring)).toBeInTheDocument();
  });

  it("série marcada só na semana passada aparece desmarcada", () => {
    renderList([task({ id: "a", repeat: { Weekly: ["Monday"] }, completed: [MONDAY - WEEK] })]);

    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "false");
  });

  it("avulsa concluída some", () => {
    renderList([
      task({ id: "a", title: "Pagar boleto", completed: [MONDAY] }),
      task({ id: "b", title: "Comprar presente" }),
    ]);

    expect(screen.queryByText("Pagar boleto")).not.toBeInTheDocument();
    expect(screen.getByText("Comprar presente")).toBeInTheDocument();
    expect(screen.getByText(copy.undated.onePending)).toBeInTheDocument();
  });

  it("vazio mostra copy.undated.empty", () => {
    renderList([]);
    expect(screen.getByText(copy.undated.empty)).toBeInTheDocument();
  });

  it("carregando (undefined) não quebra nem diz que está vazio", () => {
    renderList(undefined);
    expect(screen.queryByText(copy.undated.empty)).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(copy.undated.capture)).toBeInTheDocument();
  });

  it("lembrete vira chip crimson", () => {
    renderList([task({ id: "a", alert: new Date(2026, 9, 29, 9).getTime() })]);
    expect(screen.getByText(/qui 09:00/)).toBeInTheDocument();
  });

  it("tocar na linha abre a edição com Sem horário ligado e o dia do lembrete", () => {
    renderList([task({ id: "a", title: "Pagar", alert: new Date(2026, 9, 29, 9).getTime() })]);
    act(() => screen.getByRole("button", { name: /Pagar/ }).click());
    expect(screen.getByRole("switch", { name: copy.form.undated })).toBeChecked();
    const sheet = within(screen.getByRole("dialog"));
    expect(sheet.getByLabelText(copy.form.reminder)).toHaveValue("2026-10-29");
  });

  it("limpar o lembrete salva com alert: null (não é 'sem alterações')", async () => {
    const at = new Date(2026, 9, 29, 9).getTime();
    renderList([task({ id: "a", title: "Pagar", date: at, alert: at, tags: [] })]);
    api.updateTask.mockResolvedValue({ task: task({ id: "a", title: "Pagar" }) });
    act(() => screen.getByRole("button", { name: /Pagar/ }).click());
    const sheet = within(screen.getByRole("dialog"));
    fireEvent.change(sheet.getByLabelText(copy.form.reminder), { target: { value: "" } });
    await act(async () => sheet.getByRole("button", { name: copy.form.save }).click());
    expect(api.updateTask).toHaveBeenCalledWith(
      "token",
      "a",
      expect.objectContaining({ alert: null, undated: true }),
      undefined,
    );
  });
});

describe("<CheckHistory>", () => {
  it("3 conclusões em semanas distintas → 3 bolinhas cheias", () => {
    context([]);
    const completed = [MONDAY, MONDAY - 2 * WEEK, MONDAY - 3 * WEEK + 1000];
    const { container } = render(
      <CheckHistory
        task={task({ repeat: { Weekly: ["Monday"] }, date: MONDAY - 5 * WEEK, completed })}
        weekStart={1}
      />,
    );

    const dots = container.querySelectorAll("i");
    expect(dots).toHaveLength(6);
    expect(container.querySelectorAll('i[data-filled="true"]')).toHaveLength(3);
    expect(within(container).getByRole("img")).toHaveAttribute(
      "aria-label",
      "Feito em 3 de 6 semanas",
    );
  });

  it("limita ao número de períodos", () => {
    const { container } = render(
      <CheckHistory task={task({ repeat: "Daily", completed: [] })} weekStart={1} periods={8} />,
    );
    expect(container.querySelectorAll("i")).toHaveLength(8);
  });
});

describe("useUndatedActions", () => {
  it("desmarcar na sexta remove a conclusão de segunda (from = periodStart)", async () => {
    const series = task({
      id: "s",
      repeat: { Weekly: ["Monday"] },
      completed: [MONDAY - WEEK, MONDAY],
    });
    const setUndatedTasks = context([series]);
    api.uncompleteTaskRange.mockResolvedValue({});

    const { result } = renderHook(() => useUndatedActions(series));
    expect(result.current.done).toBe(true);

    await act(() => result.current.toggle());

    expect(api.uncompleteTaskRange).toHaveBeenCalledWith("token", "s", MONDAY_6H, FRIDAY);
    const [[next]] = setUndatedTasks.mock.calls;
    expect(next[0].completed).toEqual([MONDAY - WEEK]);
  });

  it("marcar chama completeTask com o instante do toque", async () => {
    const single = task({ id: "x" });
    context([single]);
    api.completeTask.mockResolvedValue({});

    const { result } = renderHook(() => useUndatedActions(single));
    expect(result.current.done).toBe(false);
    await act(() => result.current.toggle());

    expect(api.completeTask).toHaveBeenCalledWith("token", "x", FRIDAY);
  });

  it("recusa do servidor desfaz", async () => {
    const single = task({ id: "x" });
    const setUndatedTasks = context([single]);
    api.deleteTask.mockResolvedValue({ error: { message: "nope", offline: false } });

    const { result } = renderHook(() => useUndatedActions(single));
    await act(() => result.current.remove());

    expect(setUndatedTasks).toHaveBeenLastCalledWith([single]);
  });
});
