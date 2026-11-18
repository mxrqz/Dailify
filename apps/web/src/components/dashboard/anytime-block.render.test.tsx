/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { SetStateAction } from "react";
import type { Task } from "@dailify/shared";
import { Toaster, toast } from "sonner";

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
vi.mock("@/lib/auth", () => ({
  useSession: () => ({ data: { user: { id: "u1" } }, isPending: false }),
}));
vi.mock("@/functions/api", () => api);

import { copy } from "./copy";
import { CheckHistory } from "./check-history";
import { AnytimeBlock, DRAG_TYPE } from "./anytime-block";
import { DayList } from "./day-list";
import { DaySection, dayAnchorId } from "./day-section";
import { useUndatedActions } from "@/hooks/useUndatedActions";
import { readQueue } from "@/functions/offline";

// Sexta, 23/out/2026 12:00 local; semana começa na segunda (19/out 06:00).
const FRIDAY = new Date(2026, 9, 23, 12).getTime();
const MONDAY = new Date(2026, 9, 19, 10).getTime();
const MONDAY_6H = new Date(2026, 9, 19, 6).getTime();
const MONDAY_9H = new Date(2026, 9, 19, 9).getTime();
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

// Like the provider's useState setter: a functional update reads the current list. Each call
// returns the resulting list, so a test reads it from `mock.results`.
const listSetter = (initial: Task[] | undefined) => {
  let list = initial;
  return vi.fn((next: SetStateAction<Task[] | undefined>) => {
    list = typeof next === "function" ? next(list) : next;
    return list;
  });
};
const last = (setter: { mock: { results: { value: unknown }[] } }) =>
  setter.mock.results.at(-1)?.value;

const context = (undatedTasks: Task[] | undefined) => {
  const setUndatedTasks = listSetter(undatedTasks);
  dailify.mockReturnValue({
    undatedTasks,
    setUndatedTasks,
    weekStart: 1,
    tasks: [],
    setTasks: listSetter([]),
    bumpUsage: vi.fn(),
    selectedDay: new Date(FRIDAY),
    quotas: undefined,
    isLoading: false,
    loadedMonths: [new Date(FRIDAY)],
    loadMonth: vi.fn(),
  });
  return setUndatedTasks;
};

const renderList = (undatedTasks: Task[] | undefined) => {
  context(undatedTasks);
  return render(
    <MemoryRouter>
      <AnytimeBlock />
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
  vi.restoreAllMocks();
  toast.dismiss();
  localStorage.clear();
});

describe("<AnytimeBlock>", () => {
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

  it("vazio fica só com o campo de anotar", () => {
    renderList([]);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByText("0 pendentes")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(copy.undated.capture)).toBeInTheDocument();
  });

  it("carregando (undefined) não quebra nem mostra contagem", () => {
    renderList(undefined);
    expect(screen.queryByText(/pendente/)).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(copy.undated.capture)).toBeInTheDocument();
  });

  it("lembrete mostra o dia e a hora", () => {
    renderList([task({ id: "a", alert: new Date(2026, 9, 29, 9).getTime() })]);
    expect(screen.getByText(/qui 09:00/)).toBeInTheDocument();
  });

  it("shows the reminder time in the 12h format when the user picked it", () => {
    context([task({ id: "a", alert: new Date(2026, 9, 29, 9).getTime() })]);
    dailify.mockReturnValue({ ...dailify(), hour12: true });
    render(
      <MemoryRouter>
        <AnytimeBlock />
      </MemoryRouter>,
    );
    expect(screen.getByText(/qui 09:00 AM/)).toBeInTheDocument();
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
    touch(sheet);
    await act(async () => sheet.getByRole("button", { name: copy.form.save }).click());
    expect(api.updateTask).toHaveBeenCalledWith(
      "a",
      expect.objectContaining({ alert: null, undated: true }),
      undefined,
    );
  });

  // Ruling 8: o que a folha mostra é o que o salvar grava (09:00 de segunda já passou na sexta).
  const openEdit = (patch: Partial<Task>) => {
    renderList([task({ id: "a", title: "Pagar", alert: MONDAY_9H, tags: [], ...patch })]);
    api.updateTask.mockResolvedValue({ task: task({ id: "a", title: "Pagar" }) });
    act(() => screen.getByRole("button", { name: /Pagar/ }).click());
    return within(screen.getByRole("dialog"));
  };
  // "Salvar" só aparece depois de alguma mudança: mexe na duração pra ele existir.
  const touch = (sheet: ReturnType<typeof openEdit>) =>
    fireEvent.change(sheet.getByLabelText(copy.form.duration), { target: { value: "1h" } });

  it("avulsa com 09:00 passado mostra e salva sem lembrete", async () => {
    const sheet = openEdit({});
    expect(sheet.getByText(copy.form.noReminder)).toBeInTheDocument();
    expect(sheet.getByLabelText(copy.form.reminder)).toHaveValue("");
    expect(sheet.getByLabelText(copy.form.reminder)).toHaveAttribute("min", "2026-10-23");

    touch(sheet);
    await act(async () => sheet.getByRole("button", { name: copy.form.save }).click());
    expect(api.updateTask).toHaveBeenCalledWith(
      "a",
      expect.objectContaining({ alert: null, undated: true }),
      undefined,
    );
  });

  it("série com 09:00 passado mostra e salva a próxima ocorrência", async () => {
    const sheet = openEdit({ repeat: { Weekly: ["Monday"] } });
    expect(sheet.getByLabelText(copy.form.reminder)).toHaveValue("2026-10-26");

    touch(sheet);
    await act(async () => sheet.getByRole("button", { name: copy.form.save }).click());
    const next = MONDAY_9H + WEEK;
    expect(api.updateTask).toHaveBeenCalledWith(
      "a",
      expect.objectContaining({ alert: next, undated: true }),
      undefined,
    );
  });
});

describe("<DayList> com tarefas sem data", () => {
  const renderDayList = (undatedTasks: Task[]) => {
    context(undatedTasks);
    return render(
      <MemoryRouter>
        <DayList />
      </MemoryRouter>,
    );
  };

  it("hoje aparece com o bloco no topo mesmo sem tarefa datada", () => {
    renderDayList([task({ id: "a", title: "Comprar presente" })]);

    const block = screen.getByRole("region", { name: copy.undated.title });
    expect(block.closest("section[id]")).toHaveTextContent(copy.day.agenda);
    expect(within(block).getByText("Comprar presente")).toBeInTheDocument();
    expect(screen.queryByText(copy.day.listFirstRun)).not.toBeInTheDocument();
    expect(screen.queryByText(copy.day.emptyDay)).not.toBeInTheDocument();
  });

  it("sem tarefa nenhuma mostra o primeiro uso", () => {
    renderDayList([]);
    expect(screen.getByText(copy.day.listFirstRun)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: copy.undated.title })).not.toBeInTheDocument();
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

    expect(api.uncompleteTaskRange).toHaveBeenCalledWith("s", MONDAY_6H, FRIDAY);
    const [{ value: next }] = setUndatedTasks.mock.results;
    expect(next?.[0].completed).toEqual([MONDAY - WEEK]);
  });

  it("marcar chama completeTask com o instante do toque", async () => {
    const single = task({ id: "x" });
    context([single]);
    api.completeTask.mockResolvedValue({});

    const { result } = renderHook(() => useUndatedActions(single));
    expect(result.current.done).toBe(false);
    await act(() => result.current.toggle());

    expect(api.completeTask).toHaveBeenCalledWith("x", FRIDAY);
  });

  it("recusa do servidor desfaz", async () => {
    const single = task({ id: "x" });
    const setUndatedTasks = context([single]);
    api.deleteTask.mockResolvedValue({ error: { message: "nope", offline: false } });

    const { result } = renderHook(() => useUndatedActions(single));
    await act(() => result.current.remove());

    expect(last(setUndatedTasks)).toEqual([single]);
  });

  // Avulsa concluída some da lista: o toast é o único caminho de volta.
  const undo = async () => {
    await act(async () => (await screen.findByRole("button", { name: copy.task.undo })).click());
  };

  it("concluir avulsa oferece desfazer, que reabre", async () => {
    const single = task({ id: "x", title: "Pagar boleto" });
    const setUndatedTasks = context([single]);
    api.completeTask.mockResolvedValue({});
    api.uncompleteTaskRange.mockResolvedValue({});
    render(<Toaster />);

    const { result } = renderHook(() => useUndatedActions(single));
    await act(() => result.current.toggle());
    expect(await screen.findByText(copy.task.completed)).toBeInTheDocument();
    await undo();

    expect(api.uncompleteTaskRange).toHaveBeenCalledWith("x", 0, FRIDAY);
    expect(setUndatedTasks.mock.results.at(-1)?.value?.[0].completed).toEqual([]);
  });

  it("desfazer offline cancela a conclusão na fila", async () => {
    const single = task({ id: "x" });
    context([single]);
    const offline = { error: { message: "rede", offline: true } };
    api.completeTask.mockResolvedValue(offline);
    api.uncompleteTaskRange.mockResolvedValue(offline);
    render(<Toaster />);

    const { result } = renderHook(() => useUndatedActions(single));
    await act(() => result.current.toggle());
    await undo();

    expect(readQueue("u1")).toEqual([
      { op: "uncomplete", taskId: "x", day: 0, until: FRIDAY, at: FRIDAY },
    ]);
  });

  it("série concluída não oferece desfazer (continua na lista)", async () => {
    const series = task({ id: "s", repeat: "Daily" });
    context([series]);
    api.completeTask.mockResolvedValue({});
    const success = vi.spyOn(toast, "success");

    const { result } = renderHook(() => useUndatedActions(series));
    await act(() => result.current.toggle());
    expect(success).not.toHaveBeenCalled();
  });
});

describe("arrastar da Sem data pra um dia", () => {
  const SATURDAY = new Date(2026, 9, 24);
  const pagar = task({ id: "a", title: "Pagar boleto" });
  const drag = (types = [DRAG_TYPE]) => ({ dataTransfer: { types, getData: () => "a" } });

  const dropOn = (day: Date) => {
    const setUndatedTasks = context([pagar]);
    render(
      <MemoryRouter>
        <DaySection day={day} />
      </MemoryRouter>,
    );
    const section = document.getElementById(dayAnchorId(day));
    if (!section) throw new Error("sem seção");
    fireEvent.dragOver(section, drag());
    expect(section).toHaveAttribute("data-drop-over");
    fireEvent.drop(section, drag());
    expect(section).not.toHaveAttribute("data-drop-over");
    return { setUndatedTasks, picker: within(screen.getByRole("dialog", { name: /Horário em/ })) };
  };

  it("soltar abre a roda no dia, às 09:00", () => {
    const { picker } = dropOn(SATURDAY);
    expect(picker.getByText("Pagar boleto")).toBeInTheDocument();
    const hour = picker.getByRole("listbox", { name: copy.form.hour });
    expect(within(hour).getByRole("option", { name: "09" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("escolher o horário agenda: patch com o epoch-ms, sai da Sem data", async () => {
    Element.prototype.scrollTo = () => {};
    api.updateTask.mockResolvedValue({ task: { ...pagar, undated: false } });
    // Hoje, sexta 12:00: as 09:00 já foram, a roda abre na próxima hora cheia.
    const { setUndatedTasks, picker } = dropOn(new Date(FRIDAY));
    const hour = within(picker.getByRole("listbox", { name: copy.form.hour }));
    expect(hour.getByRole("option", { name: "13" })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(hour.getByRole("option", { name: "14" }));
    await act(async () => picker.getByRole("button", { name: copy.undated.schedule }).click());

    const at = new Date(2026, 9, 23, 14).getTime();
    expect(api.updateTask).toHaveBeenCalledWith("a", {
      date: at,
      alert: at,
      undated: false,
      updatedAt: FRIDAY,
    });
    expect(last(setUndatedTasks)).toEqual([]);
    expect(last(dailify().setTasks)).toContainEqual(
      expect.objectContaining({ id: "a", date: at, undated: false }),
    );
    expect(screen.queryByRole("dialog", { name: /Horário em/ })).not.toBeInTheDocument();
  });

  it("cancelar não mexe em nada", () => {
    const { setUndatedTasks, picker } = dropOn(SATURDAY);
    fireEvent.click(picker.getByRole("button", { name: copy.form.cancel }));

    expect(screen.queryByRole("dialog", { name: /Horário em/ })).not.toBeInTheDocument();
    expect(api.updateTask).not.toHaveBeenCalled();
    expect(setUndatedTasks).not.toHaveBeenCalled();
  });

  it("arrasto de fora (arquivo, texto) não acende nem abre", () => {
    context([pagar]);
    render(<DaySection day={SATURDAY} />);
    const section = document.getElementById(dayAnchorId(SATURDAY));
    if (!section) throw new Error("sem seção");
    fireEvent.dragOver(section, drag(["Files"]));
    fireEvent.drop(section, drag(["Files"]));
    expect(section).not.toHaveAttribute("data-drop-over");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("recusa do servidor devolve pra Sem data e tira da agenda", async () => {
    const setUndatedTasks = context([pagar]);
    api.updateTask.mockResolvedValue({ error: { message: "nope", offline: false } });

    const { result } = renderHook(() => useUndatedActions(pagar));
    await act(() => result.current.schedule(SATURDAY.getTime()));

    expect(last(setUndatedTasks)).toEqual([pagar]);
    expect(last(dailify().setTasks)).toEqual([]);
  });
});
