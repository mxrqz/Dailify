/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { IntegrationStatus, Task } from "@dailify/shared";

const { resolveDuplicate, dailify, toast } = vi.hoisted(() => ({
  resolveDuplicate: vi.fn(),
  dailify: {
    tasks: new Array<Task>(),
    undatedTasks: new Array<Task>(),
    setTasks: vi.fn(),
    setUndatedTasks: vi.fn(),
    loadedMonths: new Array<Date>(),
    hour12: false,
  },
  toast: { error: vi.fn(), success: vi.fn() },
}));
vi.mock("@/components/dailifyContext", () => ({ useDailify: () => dailify }));
vi.mock("@/functions/api", () => ({ resolveDuplicate, getIntegrations: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { copy } from "@/components/dashboard/copy";
// Carrega o grafo frio (Radix/motion) na coleta, sem hookTimeout; o resetModules do beforeEach
// só reavalia os módulos de src.
import "./duplicates-sheet";

// "Uma vez por sessão" mora no módulo: cada teste carrega o seu, como um app recém-aberto.
let Duplicates: typeof import("./duplicates-sheet").Duplicates;
let setIntegrations: typeof import("@/hooks/useIntegrations").setIntegrations;

const t = copy.calendar;
const at = new Date(2026, 10, 17, 14).getTime();
const task = (id: string, over: Partial<Task> = {}): Task => ({
  id,
  title: "Psico",
  date: at,
  duration: "50m",
  priority: 0,
  repeat: "Off",
  completed: [],
  updatedAt: at,
  ...over,
});
const status = (duplicates: IntegrationStatus["duplicates"]): IntegrationStatus => ({
  provider: "google-calendar",
  allowed: true,
  configured: true,
  connected: true,
  status: "active",
  duplicates,
});

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  ({ Duplicates } = await import("./duplicates-sheet"));
  ({ setIntegrations } = await import("@/hooks/useIntegrations"));
  dailify.tasks = [
    task("own"),
    task("imp", { links: ["https://www.google.com/calendar/event?eid=x"] }),
  ];
  dailify.undatedTasks = [];
});

describe("<Duplicates>", () => {
  it("mostra o par; Juntar aplica a tarefa devolvida e tira a importada", async () => {
    setIntegrations([status([{ taskId: "own", importedId: "imp" }])]);
    const merged = task("own", { title: "Psico", links: ["https://g/ev"] });
    resolveDuplicate.mockResolvedValue({ task: merged, removedId: "imp" });
    render(<Duplicates />);

    const sheet = await screen.findByRole("dialog", { name: t.duplicateTitle });
    expect(within(sheet).getAllByText("Psico")).toHaveLength(2);
    expect(within(sheet).getByText(/^Agenda · /)).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole("button", { name: t.merge }));

    await waitFor(() => expect(resolveDuplicate).toHaveBeenCalledWith("imp", "merge"));
    await waitFor(() => expect(dailify.setTasks).toHaveBeenCalled());
    const next: Task[] = dailify.setTasks.mock.calls[0][0];
    expect(next.map((x) => x.id)).toEqual(["own"]);
    expect(next[0].links).toEqual(["https://g/ev"]);
    expect(toast.success).toHaveBeenCalledWith(t.merged, { description: "Psico" });
  });

  it("fechar sem resolver não reabre na mesma sessão", async () => {
    setIntegrations([status([{ taskId: "own", importedId: "imp" }])]);
    const { unmount } = render(<Duplicates />);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    unmount();

    render(<Duplicates />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
