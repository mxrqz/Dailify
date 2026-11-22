/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { Task } from "@dailify/shared";
import { TZDate } from "@date-fns/tz";

const { dailify, api } = vi.hoisted(() => ({
  dailify: vi.fn(),
  api: { completeTask: vi.fn(), uncompleteTask: vi.fn() },
}));
vi.mock("@/components/dailifyContext", () => ({ useDailify: dailify }));
vi.mock("@/lib/auth", () => ({
  useSession: () => ({ data: { user: { id: "u1" } }, isPending: false }),
}));
vi.mock("@/functions/api", () => api);

import { copy } from "./copy";
import { MEW_PANEL_SLOT, PanelHost } from "./side-panel";
import { setAppTimeZone, zonedAt } from "@/functions/zone";
import { closePanel, openPanel, togglePanel, usePanel } from "@/hooks/usePanel";
import { setIntegrations } from "@/hooks/useIntegrations";

const ZONE = "America/Sao_Paulo";
const task = (id: string, title: string, hour: number, completed: number[] = []): Task => ({
  id,
  title,
  date: +zonedAt(2026, 10, 16, hour),
  duration: "",
  priority: 0,
  repeat: "Off",
  completed,
});

const setTasks = vi.fn();
beforeEach(() => {
  closePanel();
  setAppTimeZone(ZONE);
  dailify.mockReturnValue({ tasks: [], setTasks, loadedMonths: [], hour12: false });
  api.completeTask.mockResolvedValue({});
});
afterEach(() => setAppTimeZone(null));

const panel = () => screen.queryByRole("complementary");
const host = (props: Partial<Parameters<typeof PanelHost>[0]> = {}) => (
  <PanelHost onCreateOn={() => {}} onOpenDay={() => {}} {...props} />
);

describe("<PanelHost>", () => {
  it("renders nothing while closed", () => {
    render(host());
    expect(panel()).toBeNull();
  });

  it("titles each kind", () => {
    render(host());

    // MewChat portals its own panel into this slot (mew-chat.render.test).
    act(() => openPanel({ kind: "mew" }));
    expect(document.getElementById(MEW_PANEL_SLOT)).not.toBeNull();

    act(() => openPanel({ kind: "day", day: +zonedAt(2026, 10, 16) }));
    expect(panel()).toHaveAccessibleName("Segunda, 16 de novembro");
  });

  it("toggles open on the Mew, then closed", () => {
    render(host());
    act(() => togglePanel());
    expect(document.getElementById(MEW_PANEL_SLOT)).not.toBeNull();
    act(() => togglePanel());
    expect(document.getElementById(MEW_PANEL_SLOT)).toBeNull();
  });

  it("closes on Esc and on its close button", async () => {
    const user = userEvent.setup();
    render(host());

    act(() => openPanel({ kind: "day", day: 0 }));
    await user.keyboard("{Escape}");
    expect(panel()).toBeNull();

    act(() => openPanel({ kind: "day", day: 0 }));
    await user.click(screen.getByRole("button", { name: copy.panel.close }));
    expect(panel()).toBeNull();
  });

  it("edits the open occurrence of a series, and closes once it is gone", () => {
    const day = +zonedAt(2026, 10, 16, 9);
    const series: Task = {
      id: "t1",
      title: "Academia",
      date: day - 86_400_000,
      duration: "",
      priority: 0,
      repeat: "Daily",
      completed: [],
    };
    const context = (tasks: Task[]) =>
      dailify.mockReturnValue({ tasks, undatedTasks: [], setTasks: vi.fn(), loadedMonths: [] });
    context([series, { ...series, date: day }]);
    const { rerender } = render(<MemoryRouter>{host()}</MemoryRouter>);

    act(() => openPanel({ kind: "task", id: "t1", day }));
    expect(panel()).toHaveAccessibleName(copy.panel.task);
    expect(within(panel() ?? document.body).getByDisplayValue("2026-11-16")).toBeInTheDocument();

    context([series]);
    rerender(<MemoryRouter>{host()}</MemoryRouter>);
    expect(panel()).toBeNull();
  });

  it("locks the editor of a read-only invite like the sheet does", () => {
    const invite = task("t1", "Reunião", 9);
    dailify.mockReturnValue({ tasks: [invite], undatedTasks: [], setTasks, loadedMonths: [] });
    setIntegrations([
      {
        provider: "google-calendar",
        allowed: true,
        configured: true,
        connected: true,
        readonly: ["t1"],
      },
    ]);
    render(<MemoryRouter>{host()}</MemoryRouter>);

    act(() => openPanel({ kind: "task", id: "t1" }));
    expect(within(panel() ?? document.body).getByDisplayValue("2026-11-16")).toBeDisabled();
    expect(within(panel() ?? document.body).getByText(copy.calendar.readonly)).toBeVisible();
    act(() => setIntegrations(undefined));
  });

  it("leaves Esc to an open dialog above it", async () => {
    const user = userEvent.setup();
    render(
      <>
        {host()}
        <div role="dialog" data-state="open" />
      </>,
    );
    act(() => openPanel({ kind: "day", day: 0 }));
    await user.keyboard("{Escape}");
    expect(panel()).not.toBeNull();
  });
});

describe("<PanelHost> day", () => {
  // Built at collection, before beforeEach sets the app zone: name the zone explicitly.
  const day = +new TZDate(2026, 10, 16, ZONE);

  it("says the day is empty", () => {
    render(host());
    act(() => openPanel({ kind: "day", day }));
    expect(
      within(screen.getByRole("complementary")).getByText(copy.day.emptyDay),
    ).toBeInTheDocument();
  });

  it("lists the day in clock order, completes one and opens another", async () => {
    const user = userEvent.setup();
    const done = task("b", "Academia", 7, [+zonedAt(2026, 10, 16, 8)]);
    dailify.mockReturnValue({
      tasks: [task("a", "Dentista", 15), done, task("x", "Outro dia", 33)],
      setTasks,
      loadedMonths: [],
      hour12: false,
    });
    let seen: ReturnType<typeof usePanel> = null;
    const Spy = () => {
      seen = usePanel();
      return null;
    };
    render(
      <>
        {host()}
        <Spy />
      </>,
    );
    act(() => openPanel({ kind: "day", day }));

    const items = within(screen.getByRole("complementary")).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(["07:00Academia", "15:00Dentista"]);
    expect(within(items[0]).getByRole("checkbox")).toBeChecked();

    await user.click(within(items[1]).getByRole("checkbox", { name: copy.task.complete }));
    expect(api.completeTask).toHaveBeenCalledWith("a", expect.any(Number));

    await user.click(within(items[1]).getByRole("button", { name: /Dentista/ }));
    expect(seen).toEqual({ kind: "task", id: "a", day });
  });

  it("creates on the day and opens it in Hoje", async () => {
    const user = userEvent.setup();
    const onCreateOn = vi.fn();
    const onOpenDay = vi.fn();
    render(host({ onCreateOn, onOpenDay }));
    act(() => openPanel({ kind: "day", day }));

    await user.click(screen.getByRole("button", { name: copy.panel.createOnDay }));
    expect(+onCreateOn.mock.calls[0][0]).toBe(day);

    await user.click(screen.getByRole("button", { name: copy.panel.openInToday }));
    expect(+onOpenDay.mock.calls[0][0]).toBe(day);
  });
});
