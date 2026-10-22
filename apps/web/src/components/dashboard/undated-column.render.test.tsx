/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Task } from "@dailify/shared";

const { dailify } = vi.hoisted(() => ({ dailify: vi.fn() }));
vi.mock("@/components/dailifyContext", () => ({ useDailify: dailify }));
vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({ getToken: async () => "token", userId: "u1" }),
}));
vi.mock("@/functions/api", () => ({}));

import { UndatedColumn, useUndatedOpen } from "./undated-column";

const task = (patch: Partial<Task>): Task => ({
  id: "t",
  title: "Tarefa",
  date: 0,
  duration: "",
  priority: 0,
  repeat: "Off",
  completed: [],
  undated: true,
  ...patch,
});

function Harness(): JSX.Element {
  const [open, setOpen] = useUndatedOpen();
  return <UndatedColumn open={open} onOpenChange={setOpen} />;
}

const renderColumn = () => {
  dailify.mockReturnValue({
    undatedTasks: [
      task({ id: "a" }),
      task({ id: "b" }),
      task({ id: "c", completed: [Date.now()] }), // avulsa feita não conta
    ],
    setUndatedTasks: vi.fn(),
    weekStart: 1,
    tasks: [],
    setTasks: vi.fn(),
    bumpUsage: vi.fn(),
    quotas: undefined,
  });
  return render(
    <MemoryRouter>
      <Harness />
    </MemoryRouter>,
  );
};

afterEach(() => localStorage.clear());

describe("<UndatedColumn>", () => {
  it("fechada mostra só o puxador com a contagem; clicar abre e lembra", () => {
    renderColumn();

    const handle = screen.getByRole("button", { name: "Abrir Sem data (2 pendentes)" });
    expect(handle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("region", { name: "Sem data" })).toBeNull();

    fireEvent.click(handle);

    expect(handle).toHaveAttribute("aria-expanded", "true");
    expect(handle).toHaveAccessibleName("Fechar Sem data");
    expect(screen.getByRole("region", { name: "Sem data" })).toBeInTheDocument();
    expect(localStorage.getItem("dailify:undated-open")).toBe("1");
  });

  it("abre já aberta se o device lembrou", () => {
    localStorage.setItem("dailify:undated-open", "1");
    renderColumn();

    expect(screen.getByRole("button", { name: "Fechar Sem data" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });
});
