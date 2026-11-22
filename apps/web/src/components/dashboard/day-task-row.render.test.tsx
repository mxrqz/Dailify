/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Task } from "@dailify/shared";

const { dailify, api } = vi.hoisted(() => ({
  dailify: vi.fn(),
  api: { completeTask: vi.fn(), uncompleteTask: vi.fn(), deleteTask: vi.fn() },
}));
vi.mock("@/components/dailifyContext", () => ({ useDailify: dailify }));
vi.mock("@/lib/auth", () => ({
  useSession: () => ({ data: { user: { id: "u1" } }, isPending: false }),
}));
vi.mock("@/functions/api", () => api);
vi.mock("@/components/edit-task", () => ({
  EditTask: ({ children }: { children: unknown }) => children,
  EditTaskContent: ({ open }: { open: boolean }) => (open ? <div>folha aberta</div> : null),
}));

import { DayTaskRow, durationText } from "./day-task-row";
import { copy } from "./copy";
import { useTaskActions } from "@/hooks/useTaskActions";
import { closePanel, usePanel } from "@/hooks/usePanel";
import { setIntegrations } from "@/hooks/useIntegrations";
import { fill } from "@/functions/functions";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MemoryRouter } from "react-router-dom";

const day = new Date(2026, 9, 23);
const task: Task = {
  id: "t",
  title: "Reunião",
  date: new Date(2026, 9, 23, 14, 30).getTime(),
  duration: "",
  priority: 0,
  repeat: "Off",
  completed: [],
};

describe("DayTaskRow", () => {
  it("relógio mostra o horário mesmo sem o rótulo, e concluir não abre a folha", () => {
    dailify.mockReturnValue({
      tasks: [task],
      setTasks: vi.fn(),
      selectedDay: day,
      loadedMonths: [day],
      bumpUsage: vi.fn(),
    });
    api.completeTask.mockResolvedValue({});
    render(<DayTaskRow task={task} day={day} sheetEditing />);

    expect(screen.getByText("14:30")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.queryByText("folha aberta")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Reunião/ }));
    expect(screen.getByText("folha aberta")).toBeInTheDocument();
  });

  it("ligada à Agenda: selo na meta e excluir pede confirmação, sem desfazer", async () => {
    const linked = { ...task, links: ["https://www.google.com/calendar/event?eid=abc"] };
    dailify.mockReturnValue({ tasks: [linked], setTasks: vi.fn(), loadedMonths: [day] });
    api.deleteTask.mockResolvedValue({});
    render(<DayTaskRow task={linked} day={day} sheetEditing />);
    expect(screen.getByText(copy.calendar.name)).toBeInTheDocument();

    function Delete() {
      const { onDelete, deleteDialog } = useTaskActions(linked, day);
      return (
        <>
          <button onClick={() => void onDelete()}>excluir</button>
          {deleteDialog}
        </>
      );
    }
    render(<Delete />);
    fireEvent.click(screen.getByRole("button", { name: "excluir" }));
    expect(api.deleteTask).not.toHaveBeenCalled();
    await screen.findByRole("alertdialog", {
      name: "Excluir “Reunião” da Mewki e da Agenda?",
    });
    fireEvent.click(screen.getByRole("button", { name: copy.calendar.deleteConfirm }));
    await waitFor(() => expect(api.deleteTask).toHaveBeenCalledWith("t"));
  });

  it("on desktop, opens the occurrence in the side panel and offers time, day and more chips", async () => {
    const series = { ...task, repeat: "Daily" as const };
    dailify.mockReturnValue({ tasks: [series], setTasks: vi.fn(), loadedMonths: [day] });
    const user = userEvent.setup();
    render(<DayTaskRow task={series} day={day} sheetEditing={false} />);

    const title = { title: task.title };
    expect(screen.getByRole("button", { name: fill(copy.task.editTime, title) })).toBeVisible();
    expect(screen.getByRole("button", { name: fill(copy.task.editDay, title) })).toBeVisible();
    await user.click(screen.getByRole("button", { name: /^14:30/ }));
    expect(screen.queryByText("folha aberta")).toBeNull();
    expect(renderHook(() => usePanel()).result.current).toEqual({
      kind: "task",
      id: "t",
      day: series.date,
    });
    expect(screen.getByRole("button", { name: /^14:30/, current: true })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: fill(copy.task.more, title) }));
    await user.click(await screen.findByRole("menuitem", { name: copy.task.delete }));
    // A series asks the scope first.
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    act(() => closePanel());
  });

  it("on desktop, a read-only invite offers no time or day chip", () => {
    dailify.mockReturnValue({ tasks: [task], setTasks: vi.fn(), loadedMonths: [day] });
    setIntegrations([
      {
        provider: "google-calendar",
        allowed: true,
        configured: true,
        connected: true,
        readonly: ["t"],
      },
    ]);
    render(<DayTaskRow task={task} day={day} sheetEditing={false} />);

    const title = { title: task.title };
    expect(screen.queryByRole("button", { name: fill(copy.task.editTime, title) })).toBeNull();
    expect(screen.queryByRole("button", { name: fill(copy.task.editDay, title) })).toBeNull();
    expect(screen.getByRole("button", { name: fill(copy.task.more, title) })).toBeVisible();
    act(() => setIntegrations(undefined));
  });

  it.each([true, false])("a multi-day task shows its day count instead of the clock", (sheet) => {
    const trip = { ...task, date: new Date(2026, 9, 22).getTime(), duration: "72h" };
    dailify.mockReturnValue({ tasks: [trip], setTasks: vi.fn(), loadedMonths: [day] });
    render(
      <MemoryRouter>
        <TooltipProvider>
          <DayTaskRow task={trip} day={day} sheetEditing={sheet} />
        </TooltipProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText(fill(copy.day.spanDay, { k: 2, n: 3 }))).toBeInTheDocument();
    expect(screen.queryByText("00:00")).toBeNull();
  });

  it("duração: minutos, horas e horas com minutos", () => {
    expect([15, 60, 90, 125].map(durationText)).toEqual(["15 min", "1h", "1h30", "2h05"]);
  });
});
