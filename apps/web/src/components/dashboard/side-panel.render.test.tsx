/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Task } from "@dailify/shared";

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
import { PanelHost } from "./side-panel";
import { setAppTimeZone, zonedAt } from "@/functions/zone";
import { closePanel, openPanel, togglePanel, usePanel } from "@/hooks/usePanel";

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

    act(() => openPanel({ kind: "task", id: "t1" }));
    expect(panel()).toHaveAccessibleName(copy.panel.task);

    act(() => openPanel({ kind: "mew" }));
    expect(panel()).toHaveAccessibleName(copy.panel.mew);

    act(() => openPanel({ kind: "day", day: +zonedAt(2026, 10, 16) }));
    expect(panel()).toHaveAccessibleName("Segunda, 16 de novembro");
  });

  it("toggles open on the Mew, then closed", () => {
    render(host());
    act(() => togglePanel());
    expect(panel()).toHaveAccessibleName(copy.panel.mew);
    act(() => togglePanel());
    expect(panel()).toBeNull();
  });

  it("closes on Esc and on its close button", async () => {
    const user = userEvent.setup();
    render(host());

    act(() => openPanel({ kind: "mew" }));
    await user.keyboard("{Escape}");
    expect(panel()).toBeNull();

    act(() => openPanel({ kind: "mew" }));
    await user.click(screen.getByRole("button", { name: copy.panel.close }));
    expect(panel()).toBeNull();
  });

  it("leaves Esc to an open dialog above it", async () => {
    const user = userEvent.setup();
    render(
      <>
        {host()}
        <div role="dialog" data-state="open" />
      </>,
    );
    act(() => openPanel({ kind: "mew" }));
    await user.keyboard("{Escape}");
    expect(panel()).not.toBeNull();
  });
});

describe("<PanelHost> day", () => {
  const day = +zonedAt(2026, 10, 16);

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
