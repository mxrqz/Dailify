/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { addDays, addMonths, startOfDay, startOfMonth } from "date-fns";
import type { ExternalEvent, IntegrationStatus, Task } from "@dailify/shared";

const dailify = vi.hoisted((): { current: Record<string, unknown> } => ({ current: {} }));
const { useOnline, api, toast } = vi.hoisted(() => ({
  useOnline: vi.fn(),
  api: { getCalendarEvents: vi.fn(), linkCalendarEvent: vi.fn(), getIntegrations: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock("@/components/dailifyContext", () => ({ useDailify: () => dailify.current }));
// getToken novo a cada render, de propósito: o laço de refetch apareceria aqui.
vi.mock("@clerk/clerk-react", () => ({ useAuth: () => ({ getToken: async () => "t" }) }));
vi.mock("@/hooks/useOnline", () => ({ useOnline }));
vi.mock("@/functions/api", () => api);
vi.mock("sonner", () => ({ toast }));
vi.mock("@/components/dashboard/day-task-row", () => ({
  DayTaskRow: ({ task }: { task: Task }) => <div data-testid="task">{task.title}</div>,
}));
vi.mock("@/components/dashboard/anytime-block", () => ({
  AnytimeBlock: () => null,
  ScheduleDrop: ({ children }: { children: JSX.Element }) => children,
}));

import { DayList } from "./day-list";
import { copy } from "@/components/dashboard/copy";
import { setIntegrations } from "@/hooks/useIntegrations";
import { forgetExternalEvents, HIDE_EVENTS_KEY } from "@/hooks/useExternalEvents";

const t = copy.calendar;
const GCAL: IntegrationStatus = {
  provider: "google-calendar",
  allowed: true,
  configured: true,
  connected: true,
  status: "active",
};
const at = startOfDay(addDays(new Date(), 1)).getTime() + 10 * 3600_000;
const event = (over: Partial<ExternalEvent> = {}): ExternalEvent => ({
  id: "ev1",
  title: "Dentista",
  start: at,
  end: at + 3600_000,
  allDay: false,
  url: "https://www.google.com/calendar/event?eid=ev1",
  meet: "https://meet.google.com/abc-defg-hij",
  ...over,
});
const task = (over: Partial<Task> = {}): Task => ({
  id: "task01",
  title: "Outra coisa",
  date: at + 2 * 3600_000,
  duration: "30m",
  priority: 0,
  repeat: "Off",
  completed: [],
  ...over,
});
const setTasks = vi.fn();
let events: ExternalEvent[];

function setup(tasks: Task[] = [task()]) {
  const now = new Date();
  dailify.current = {
    selectedDay: now,
    tasks,
    setTasks,
    undatedTasks: [],
    setUndatedTasks: vi.fn(),
    isLoading: null,
    hour12: false,
    loadedMonths: [startOfMonth(now), startOfMonth(addMonths(now, 1))],
    loadMonth: vi.fn(),
  };
  return render(
    <MemoryRouter>
      <DayList />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  forgetExternalEvents();
  setIntegrations([GCAL]);
  useOnline.mockReturnValue(true);
  events = [event()];
  api.getCalendarEvents.mockImplementation(async (_t: string, from: number, to: number) => ({
    events: events.filter((e) => e.start >= from && e.start < to),
  }));
});
afterEach(() => setIntegrations(undefined));

describe("eventos do Google na agenda", () => {
  it("linha só leitura e distinta: logo, hora, título, Abrir no Google e Meet; nada de botão", async () => {
    setup();
    const row = await screen.findByRole("group", { name: t.event });
    expect(row).toHaveTextContent("Dentista");
    expect(row).toHaveTextContent("10:00");
    expect(within(row).getByRole("link", { name: t.openInGoogle })).toHaveAttribute(
      "href",
      event().url,
    );
    expect(within(row).getByRole("link", { name: t.meetLink })).toHaveAttribute(
      "href",
      event().meet,
    );
    expect(within(row).queryByRole("button")).toBeNull();
    expect(within(row).queryByRole("checkbox")).toBeNull();
  });

  it("um GET por mês, mesmo com vários re-renders", async () => {
    const { rerender } = setup();
    await screen.findByRole("group", { name: t.event });
    for (let i = 0; i < 5; i++)
      rerender(
        <MemoryRouter>
          <DayList />
        </MemoryRouter>,
      );
    await screen.findByRole("group", { name: t.event });
    expect(api.getCalendarEvents).toHaveBeenCalledTimes(2);
  });

  it("evento da Mewki não aparece", async () => {
    events = [event({ mewkiTaskId: "task01" })];
    setup();
    await waitFor(() => expect(api.getCalendarEvents).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("group", { name: t.event })).toBeNull();
  });

  it.each([
    ["toggle desligado", () => localStorage.setItem(HIDE_EVENTS_KEY, "1")],
    ["agenda desconectada", () => setIntegrations([{ ...GCAL, connected: false }])],
    ["offline", () => useOnline.mockReturnValue(false)],
  ])("%s: nem lê nem mostra", async (_, arrange) => {
    arrange();
    setup();
    await screen.findByTestId("task");
    expect(api.getCalendarEvents).not.toHaveBeenCalled();
    expect(screen.queryByRole("group", { name: t.event })).toBeNull();
  });

  it("tarefa igual ao evento sugere Vincular; confirmar chama a API e a duplicata some", async () => {
    const mine = task({ title: "dentista", date: at + 10 * 60_000 });
    const linked = { ...mine, links: [event().url] };
    api.linkCalendarEvent.mockResolvedValue({ task: linked });
    setup([mine]);

    await userEvent.click(await screen.findByRole("button", { name: t.link }));
    expect(screen.getByText(t.linkPreview.replace("{title}", "Dentista"))).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: copy.confirmAction.confirm }));

    expect(api.linkCalendarEvent).toHaveBeenCalledWith("t", "task01", "ev1");
    expect(setTasks).toHaveBeenCalledWith([
      expect.objectContaining({ id: "task01", links: linked.links }),
    ]);
    expect(toast.success).toHaveBeenCalledWith(t.linkDone);
    await waitFor(() => expect(screen.queryByRole("group", { name: t.event })).toBeNull());
  });

  it("sem casamento, sem sugestão", async () => {
    setup();
    await screen.findByRole("group", { name: t.event });
    expect(screen.queryByRole("button", { name: t.link })).toBeNull();
  });
});
