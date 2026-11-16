/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ParsedTaskWire, Task } from "@dailify/shared";

import { zonedAt } from "@/functions/zone";
import { setIntegrations } from "@/hooks/useIntegrations";
import { copy } from "./copy";

const api = vi.hoisted(() => ({
  parseTaskAi: vi.fn(),
  createTask: vi.fn(),
  deleteTask: vi.fn(),
  createCalendarEvent: vi.fn(),
  getIntegrations: vi.fn(),
}));
const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), message: vi.fn(), info: vi.fn() }),
);
const ctx = vi.hoisted(() => ({ setTasks: vi.fn() }));

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({ getToken: async () => "token", userId: "u1" }),
}));
vi.mock("@/components/dailifyContext", () => ({
  useDailify: () => ({
    hour12: false,
    quotas: { limits: { tasks: -1, ai: 30 }, usage: { tasks: 0, ai: 0 } },
    bumpUsage: vi.fn(),
    tasks: [],
    setTasks: ctx.setTasks,
    undatedTasks: [],
    setUndatedTasks: vi.fn(),
    loadedMonths: [],
  }),
}));
vi.mock("@/functions/api", () => api);
vi.mock("sonner", () => ({ toast }));
vi.mock("@/hooks/useVoiceCreate", () => ({
  useVoiceCreate: () => ({ state: "idle", start: vi.fn(), stop: vi.fn() }),
  voiceSupported: () => false,
}));

import { useCreateTask } from "@/hooks/useCreateTask";
import { TaskComposer } from "./task-composer";

const t = copy.calendar;
const EVENT = "https://www.google.com/calendar/event?eid=abc";

// O caminho de verdade da Home: o composer entrega, o `create` cria e manda pro Google.
function Harness(): JSX.Element {
  const { create } = useCreateTask();
  return <TaskComposer onSubmit={({ parsed, calendar }) => create(parsed, { calendar })} />;
}

const setup = () => {
  render(
    <MemoryRouter>
      <Harness />
    </MemoryRouter>,
  );
  return userEvent.setup();
};

const connect = (connected: boolean) =>
  setIntegrations([
    {
      provider: "google-calendar",
      allowed: true,
      configured: true,
      connected,
      status: "active",
    },
  ]);

const send = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: copy.composer.submit }));
const chip = () => screen.queryByRole("button", { name: t.chipLabel });
const meet = () => screen.queryByRole("button", { name: t.meet });
const linked = (id: string): { task: Task } => ({
  task: {
    id,
    title: "x",
    date: 0,
    duration: "30m",
    priority: 0,
    repeat: "Off",
    completed: [],
    links: [EVENT],
  },
});

const draft = (text: string, hour: number): ParsedTaskWire => ({
  text,
  date: zonedAt(2030, 0, 10, hour).getTime(),
  hasTime: true,
  hasDay: true,
  duration: null,
  links: [],
  repeat: "Off",
});

beforeEach(() => {
  vi.resetAllMocks();
  connect(true);
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  api.createTask.mockImplementation(async (_token, input) => ({
    task: { ...input, completed: [] },
  }));
  api.createCalendarEvent.mockImplementation(async (_token, id: string) => linked(id));
});

describe("<TaskComposer> etiqueta Google Agenda", () => {
  it("escondida sem conexão, offline ou sem dia", async () => {
    connect(false);
    const user = setup();
    await user.type(screen.getByRole("textbox"), "dentista amanhã às 15h");
    expect(chip()).not.toBeInTheDocument();

    connect(true);
    expect(await screen.findByRole("button", { name: t.chipLabel })).toBeInTheDocument();
    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "comprar pão");
    expect(chip()).not.toBeInTheDocument();
  });

  it("offline, não aparece", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const user = setup();
    await user.type(screen.getByRole("textbox"), "dentista amanhã às 15h");
    expect(chip()).not.toBeInTheDocument();
  });

  it("desligada por padrão: criar não chama o Google", async () => {
    const user = setup();
    await user.type(screen.getByRole("textbox"), "dentista amanhã às 15h");
    expect(chip()).toHaveAttribute("aria-pressed", "false");
    expect(meet()).not.toBeInTheDocument();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(api.createTask).toHaveBeenCalled());
    expect(api.createCalendarEvent).not.toHaveBeenCalled();
  });

  it("ligada: cria, manda pro Google, aplica a tarefa com o link e zera a etiqueta", async () => {
    const user = setup();
    await user.type(screen.getByRole("textbox"), "dentista amanhã às 15h");
    await user.click(chip()!);
    expect(chip()).toHaveAttribute("aria-pressed", "true");
    await send(user);

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(t.createdAdded));
    const id = api.createTask.mock.calls[0][1].id;
    expect(api.createCalendarEvent).toHaveBeenCalledWith("token", id, false);
    expect(ctx.setTasks).toHaveBeenLastCalledWith([expect.objectContaining({ links: [EVENT] })]);

    await user.type(screen.getByRole("textbox"), "outra amanhã às 9h");
    expect(chip()).toHaveAttribute("aria-pressed", "false");
  });

  it("+ Meet manda meet: true; com link de vídeo no texto, some", async () => {
    const user = setup();
    await user.type(screen.getByRole("textbox"), "call amanhã às 15h");
    await user.click(chip()!);
    await user.click(meet()!);
    expect(meet()).toHaveAttribute("aria-pressed", "true");
    await send(user);
    await waitFor(() =>
      expect(api.createCalendarEvent).toHaveBeenCalledWith("token", expect.any(String), true),
    );

    await user.type(screen.getByRole("textbox"), "call amanhã às 15h https://meet.google.com/abc");
    await user.click(chip()!);
    expect(meet()).not.toBeInTheDocument();
  });

  it("o Google falha: a tarefa fica e o toast tenta de novo", async () => {
    api.createCalendarEvent.mockResolvedValueOnce({ error: { message: "boom", offline: false } });
    const user = setup();
    await user.type(screen.getByRole("textbox"), "dentista amanhã às 15h");
    await user.click(chip()!);
    await send(user);

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const [title, opts] = toast.error.mock.calls[0];
    expect(title).toBe(t.notAdded);
    expect(api.deleteTask).not.toHaveBeenCalled();
    expect(opts.action.label).toBe(t.tryAgain);

    opts.action.onClick();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(t.createdAdded));
    expect(api.createCalendarEvent).toHaveBeenCalledTimes(2);
  });

  it("reconnect: oferece reconectar, sem tentar de novo", async () => {
    api.createCalendarEvent.mockResolvedValueOnce({
      error: { message: "revoked", offline: false, code: "reconnect" },
    });
    const user = setup();
    await user.type(screen.getByRole("textbox"), "dentista amanhã às 15h");
    await user.click(chip()!);
    await send(user);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        t.revoked,
        expect.objectContaining({ action: expect.objectContaining({ label: t.reconnect }) }),
      ),
    );
    expect(chip()).not.toBeInTheDocument();
  });

  it("a criação falha: o Google nem é chamado", async () => {
    api.createTask.mockResolvedValue({ error: { message: "nope", offline: false } });
    const user = setup();
    await user.type(screen.getByRole("textbox"), "dentista amanhã às 15h");
    await user.click(chip()!);
    await send(user);
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(copy.form.createError, expect.anything()),
    );
    expect(api.createCalendarEvent).not.toHaveBeenCalled();
  });

  it("vários rascunhos: etiqueta por linha; falha parcial num toast só, com retry", async () => {
    api.parseTaskAi.mockResolvedValue({
      result: {
        reply: "",
        intent: "create",
        drafts: [draft("Pão", 9), draft("Leite", 10), draft("Café", 11)],
      },
    });
    api.createCalendarEvent
      .mockResolvedValueOnce({ error: { message: "boom", offline: false } })
      .mockResolvedValueOnce({ error: { message: "boom", offline: false } });
    const user = setup();
    await user.type(screen.getByRole("textbox"), "pão às 9, leite às 10 e café às 11");
    await user.click(screen.getByRole("button", { name: /Melhorar com a Mew/ }));

    const chips = screen.getAllByRole("button", { name: t.chipLabel });
    expect(chips).toHaveLength(3);
    await user.click(chips[0]);
    await user.click(chips[2]);
    await user.click(screen.getByRole("button", { name: "Criar 3 tarefas" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const ids = api.createTask.mock.calls.map((call) => call[1].id);
    expect(api.createCalendarEvent.mock.calls.map((call) => call[1])).toEqual([ids[0], ids[2]]);
    const [title, opts] = toast.error.mock.calls[0];
    expect(title).toBe(t.notAddedMany.replace("{n}", "2"));

    opts.action.onClick();
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(t.createdAddedMany.replace("{n}", "2")),
    );
  });
});
