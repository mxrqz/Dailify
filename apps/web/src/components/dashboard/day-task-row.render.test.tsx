/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Task } from "@dailify/shared";

const { dailify, api } = vi.hoisted(() => ({
  dailify: vi.fn(),
  api: { completeTask: vi.fn(), uncompleteTask: vi.fn() },
}));
vi.mock("@/components/dailifyContext", () => ({ useDailify: dailify }));
vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({ getToken: async () => "token", userId: "u1" }),
  useUser: () => ({ user: { id: "u1" } }),
}));
vi.mock("@/functions/api", () => api);
// Toque: o cartão vira overlay que abre a folha.
vi.mock("@/hooks/useMediaQuery", () => ({ useMediaQuery: () => true }));
vi.mock("@/components/edit-task", () => ({
  EditTask: ({ children }: { children: unknown }) => children,
  EditTaskContent: ({ open }: { open: boolean }) => (open ? <div>folha aberta</div> : null),
}));

import { DayTaskRow } from "./day-task-row";

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
    const { container } = render(<DayTaskRow task={task} day={day} showTime={false} />);

    expect(container.querySelector("[data-dot]")?.getAttribute("cy")).not.toBe("10");
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.queryByText("folha aberta")).toBeNull();
  });
});
