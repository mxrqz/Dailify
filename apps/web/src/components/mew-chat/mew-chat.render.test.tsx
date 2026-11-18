/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { SetStateAction } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MEW_CONSENT_REQUIRED, QUOTA_ERRORS, type MewReply, type Task } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";

import { MewChat } from "./mew-chat";

const api = vi.hoisted(() => ({
  mewChat: vi.fn(),
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
  setMewAction: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  createCalendarEvent: vi.fn(),
}));
vi.mock("@/functions/api", () => api);

// The setters apply functional updates, as the real useState setters do.
const ctx = vi.hoisted(() => ({
  tasks: new Array<Task>(),
  undatedTasks: new Array<Task>(),
  loadedMonths: [],
  setTasks: vi.fn((next: SetStateAction<Task[] | undefined>) => {
    ctx.tasks = (typeof next === "function" ? next(ctx.tasks) : next) ?? [];
  }),
  setUndatedTasks: vi.fn((next: SetStateAction<Task[] | undefined>) => {
    ctx.undatedTasks = (typeof next === "function" ? next(ctx.undatedTasks) : next) ?? [];
  }),
  bumpUsage: vi.fn(),
  goToDay: vi.fn(),
  quotas: undefined,
  hour12: false,
}));
vi.mock("@/components/dailifyContext", () => ({ useDailify: () => ctx }));
vi.mock("@/lib/auth", () => ({ useSession: () => ({ data: { user: { id: "u1" } } }) }));

const t = copy.mewChat;
const bread: Task = {
  id: "srv-1",
  title: "Comprar pão",
  date: Date.now(),
  duration: "",
  priority: 0,
  repeat: "Off",
  completed: [],
};
const proposal: MewReply = {
  reply: "Achei 1 tarefa.",
  intent: "propose",
  blocks: [{ kind: "confirm", id: "act-1", action: "create", before: [], after: [bread] }],
};

const mount = () => {
  const onCompose = vi.fn();
  render(
    <MemoryRouter>
      <MewChat onCompose={onCompose} />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: t.open }));
  return { onCompose, chat: screen.getByRole("dialog") };
};

const say = (text: string) => {
  fireEvent.change(screen.getByRole("textbox", { name: t.placeholder }), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole("button", { name: t.send }));
};

beforeEach(() => {
  localStorage.clear();
  ctx.tasks = [];
  ctx.undatedTasks = [];
  api.getSettings.mockResolvedValue({ settings: { mewConsent: true } });
  api.saveSettings.mockResolvedValue({ settings: { mewConsent: true } });
  api.createTask.mockResolvedValue({ task: bread });
  api.deleteTask.mockResolvedValue({});
  api.setMewAction.mockResolvedValue(undefined);
});

describe("MewChat", () => {
  it("asks the server, confirms the box into the agenda and undoes it", async () => {
    api.mewChat.mockResolvedValue({ reply: proposal });
    const { chat } = mount();
    say("comprar pão amanhã");

    const create = await within(chat).findByRole("button", { name: "Criar 1" });
    expect(api.mewChat).toHaveBeenCalledWith(
      expect.objectContaining({ text: "comprar pão amanhã", history: [] }),
    );
    expect(ctx.bumpUsage).toHaveBeenCalledWith("ai");

    fireEvent.click(create);
    await waitFor(() => expect(api.setMewAction).toHaveBeenCalledWith("act-1", "done"));
    expect(api.createTask).toHaveBeenCalledWith(expect.objectContaining({ id: "srv-1" }));
    expect(ctx.tasks).toEqual([expect.objectContaining({ id: "srv-1" })]);

    fireEvent.click(await within(chat).findByRole("button", { name: t.box.undo }));
    await waitFor(() => expect(api.setMewAction).toHaveBeenCalledWith("act-1", "undone"));
    expect(api.deleteTask).toHaveBeenCalledWith("srv-1");
    expect(await within(chat).findByText(t.box.undone)).toBeInTheDocument();
  });

  it("a refused write puts the box back to draft", async () => {
    api.mewChat.mockResolvedValue({ reply: proposal });
    api.createTask.mockResolvedValue({ error: { message: "nope", offline: false, status: 500 } });
    const { chat } = mount();
    say("comprar pão");
    fireEvent.click(await within(chat).findByRole("button", { name: "Criar 1" }));
    expect(await within(chat).findByRole("button", { name: "Criar 1" })).toBeInTheDocument();
    expect(api.setMewAction).not.toHaveBeenCalled();
  });

  it("without consent shows the LGPD card, and accepting resends the message", async () => {
    api.getSettings.mockResolvedValue({ settings: { mewConsent: false } });
    api.mewChat
      .mockResolvedValueOnce({
        error: { message: MEW_CONSENT_REQUIRED, offline: false, status: 403 },
      })
      .mockResolvedValueOnce({ reply: { reply: "Oi!", intent: "answer", blocks: [] } });
    const { chat } = mount();
    expect(await within(chat).findByText(t.consentTitle)).toBeInTheDocument();
    say("oi");

    fireEvent.click(await within(chat).findByRole("button", { name: t.consentAccept }));
    await waitFor(() => expect(api.saveSettings).toHaveBeenCalledWith({ mewConsent: true }));
    expect(await within(chat).findByText("Oi!")).toBeInTheDocument();
    expect(api.mewChat).toHaveBeenCalledTimes(2);
    expect(within(chat).queryByText(t.consentTitle)).toBeNull();
  });

  it("out of credits, the Mew says so and no credit is counted", async () => {
    api.mewChat.mockResolvedValue({
      error: { message: QUOTA_ERRORS.ai, offline: false, status: 429 },
    });
    const { chat } = mount();
    say("oi");
    expect(await within(chat).findByText(/esgotados/)).toBeInTheDocument();
    expect(ctx.bumpUsage).not.toHaveBeenCalled();
  });

  it("the empty state's Nova tarefa opens the classic composer", () => {
    const { chat, onCompose } = mount();
    fireEvent.click(within(chat).getByRole("button", { name: copy.composer.open }));
    expect(onCompose).toHaveBeenCalled();
  });
});
