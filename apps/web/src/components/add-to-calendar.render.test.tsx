/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { SetStateAction } from "react";
import type { IntegrationStatus, Task } from "@dailify/shared";

const { dailify, useOnline, api, toast, navigate } = vi.hoisted(() => ({
  dailify: vi.fn(),
  useOnline: vi.fn(),
  api: { createCalendarEvent: vi.fn(), syncCalendarEvent: vi.fn(), getIntegrations: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  navigate: vi.fn(),
}));
vi.mock("@/components/dailifyContext", () => ({ useDailify: dailify }));
vi.mock("@/hooks/useOnline", () => ({ useOnline }));
vi.mock("@/functions/api", () => api);
vi.mock("sonner", () => ({ toast }));
vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => navigate,
}));

import { AddToCalendar } from "./add-to-calendar";
import { ConfirmAction } from "./mew/confirm-action";
import { copy } from "@/components/dashboard/copy";
import { setIntegrations } from "@/hooks/useIntegrations";

const t = copy.calendar;
const EVENT = "https://www.google.com/calendar/event?eid=abc";
const GCAL: IntegrationStatus = {
  provider: "google-calendar",
  allowed: true,
  configured: true,
  connected: true,
  status: "active",
};
const task: Task = {
  id: "task01",
  title: "Dentista",
  date: Date.now() + 86_400_000,
  duration: "30m",
  priority: 0,
  repeat: "Off",
  completed: [],
};
// The real provider passes useState setters: a functional update reads the list of the moment.
let store: Task[] = [];
const setTasks = vi.fn((next: SetStateAction<Task[] | undefined>) => {
  store = (typeof next === "function" ? next(store) : next) ?? [];
});

beforeEach(() => {
  store = [task];
  setIntegrations([GCAL]);
  useOnline.mockReturnValue(true);
  dailify.mockReturnValue({
    tasks: [task],
    setTasks,
    undatedTasks: [],
    setUndatedTasks: vi.fn(),
    loadedMonths: [],
  });
});

const renderWith = (over: Partial<Task> = {}) =>
  render(
    <MemoryRouter>
      <AddToCalendar task={{ ...task, ...over }} variant="sheet" />
    </MemoryRouter>,
  );

describe("<ConfirmAction>", () => {
  it("mostra o preview, a opção e confirma/cancela", async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    const onChange = vi.fn();
    render(
      <ConfirmAction
        open
        onOpenChange={onOpenChange}
        preview="Criar evento na Agenda · amanhã 15:00–15:30"
        option={{ label: t.meet, checked: false, onChange }}
        onConfirm={onConfirm}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/amanhã 15:00–15:30/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("switch", { name: t.meet }));
    expect(onChange).toHaveBeenCalledWith(true);
    await userEvent.click(within(dialog).getByRole("button", { name: copy.confirmAction.confirm }));
    expect(onConfirm).toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: copy.confirmAction.cancel }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("<AddToCalendar>", () => {
  it("aparece só com a agenda ativa, online e tarefa com dia", () => {
    const { unmount } = renderWith();
    expect(screen.getByRole("button", { name: t.add })).toBeInTheDocument();
    unmount();

    renderWith({ undated: true }).unmount();
    expect(screen.queryByRole("button", { name: t.add })).not.toBeInTheDocument();

    useOnline.mockReturnValue(false);
    renderWith().unmount();
    expect(screen.queryByRole("button", { name: t.add })).not.toBeInTheDocument();

    useOnline.mockReturnValue(true);
    setIntegrations([{ ...GCAL, status: "revoked" }]);
    renderWith();
    expect(screen.queryByRole("button", { name: t.add })).not.toBeInTheDocument();
  });

  it("já vinculada vira o link pro evento", () => {
    renderWith({ links: [EVENT] });
    expect(screen.getByRole("link", { name: t.linked })).toHaveAttribute("href", EVENT);
    expect(screen.queryByRole("button", { name: t.add })).not.toBeInTheDocument();
  });

  it("sucesso: confirma com Meet, atualiza a lista e avisa", async () => {
    const updated = { ...task, links: [EVENT] };
    api.createCalendarEvent.mockResolvedValue({ link: { url: EVENT }, task: updated });
    renderWith();

    await userEvent.click(screen.getByRole("button", { name: t.add }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/^Criar evento na Agenda · amanhã/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("switch", { name: t.meet }));
    expect(within(dialog).getByText(/com Meet$/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: copy.confirmAction.confirm }));

    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(api.createCalendarEvent).toHaveBeenCalledWith("task01", true);
    expect(store).toEqual([updated]);
  });

  it("revogado: toast com Reconectar levando a /settings", async () => {
    api.createCalendarEvent.mockResolvedValue({
      error: { message: "x", offline: false, status: 409, code: "reconnect" },
    });
    renderWith();
    await userEvent.click(screen.getByRole("button", { name: t.add }));
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: copy.confirmAction.confirm,
      }),
    );

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const [message, options] = toast.error.mock.calls[0];
    expect(message).toBe(t.revoked);
    options.action.onClick();
    expect(navigate).toHaveBeenCalledWith("/settings");
    expect(setTasks).not.toHaveBeenCalled();
    // O status passa a revogado: o botão some sem esperar outro GET.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: t.add })).not.toBeInTheDocument(),
    );
  });

  it("already_linked: põe a tarefa do servidor na lista na hora", async () => {
    const updated = { ...task, links: [EVENT] };
    api.createCalendarEvent.mockResolvedValue({
      link: { url: EVENT },
      task: updated,
      error: { message: "x", offline: false, status: 409, code: "already_linked" },
    });
    renderWith();
    await userEvent.click(screen.getByRole("button", { name: t.add }));
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: copy.confirmAction.confirm,
      }),
    );
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith(t.alreadyLinked));
    expect(store).toEqual([updated]);
  });

  it("série: o preview mostra a regra e o início, não o dia tocado", async () => {
    const start = new Date(2026, 10, 16, 10).getTime();
    renderWith({
      date: new Date(2026, 10, 30, 10).getTime(),
      seriesStart: start,
      repeat: { Weekly: ["Monday"] },
    });
    await userEvent.click(screen.getByRole("button", { name: t.add }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/toda segunda 10:00–10:30, desde 16\/11/)).toBeInTheDocument();
  });

  it("stale: mostra não sincronizado e o reenviar limpa", async () => {
    setIntegrations([{ ...GCAL, stale: [task.id] }]);
    api.syncCalendarEvent.mockResolvedValue({ task: { ...task, links: [EVENT] } });
    renderWith({ links: [EVENT] });
    expect(screen.getByRole("link", { name: new RegExp(t.unsynced) })).toHaveAttribute(
      "href",
      EVENT,
    );
    await userEvent.click(screen.getByRole("button", { name: t.retry }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(t.synced));
    expect(api.syncCalendarEvent).toHaveBeenCalledWith("task01");
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: t.retry })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("link", { name: t.linked })).toBeInTheDocument();
  });
});
