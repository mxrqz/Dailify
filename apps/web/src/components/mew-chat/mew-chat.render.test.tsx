/** @vitest-environment jsdom */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { SetStateAction } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  API_ERROR,
  MEW_CONSENT_REQUIRED,
  QUOTA_ERRORS,
  type MewReply,
  type Task,
} from "@dailify/shared";

import { CreditsTray } from "@/components/credits-tray";
import { copy } from "@/components/dashboard/copy";
import { PanelHost } from "@/components/dashboard/side-panel";
import { setCreditsTray } from "@/hooks/useCreditsTray";
import { closePanel, openPanel } from "@/hooks/usePanel";

import { copy as t } from "./copy";
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
      <CreditsTray />
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
  setCreditsTray(false);
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

  it("editing one draft in the task sheet writes nothing until the box is confirmed", async () => {
    api.mewChat.mockResolvedValue({ reply: proposal });
    const { chat } = mount();
    say("comprar pão");

    fireEvent.click(
      await within(chat).findByRole("button", { name: new RegExp(`^Editar ${bread.title}`) }),
    );
    const sheet = await screen.findByRole("dialog", { name: copy.form.editTitle });
    fireEvent.change(within(sheet).getByRole("combobox", { name: copy.form.priority }), {
      target: { value: "2" },
    });
    fireEvent.click(within(sheet).getByRole("button", { name: copy.form.save }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: copy.form.editTitle })).toBeNull(),
    );
    expect(api.createTask).not.toHaveBeenCalled();
    expect(chat).toBeInTheDocument();

    fireEvent.click(within(chat).getByRole("button", { name: "Criar 1" }));
    await waitFor(() =>
      expect(api.createTask).toHaveBeenCalledWith(
        expect.objectContaining({ id: "srv-1", title: bread.title, priority: 2 }),
      ),
    );
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
        error: {
          message: MEW_CONSENT_REQUIRED,
          offline: false,
          status: 403,
          code: API_ERROR.mewConsentRequired,
        },
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

  it("out of credits, the Mew says so, the upgrade tray rises and no credit is counted", async () => {
    api.mewChat.mockResolvedValue({
      error: { message: QUOTA_ERRORS.ai, offline: false, status: 429, code: API_ERROR.aiExhausted },
    });
    const { chat } = mount();
    say("oi");
    expect(await within(chat).findByText(/esgotados/)).toBeInTheDocument();
    expect(screen.getByRole("alertdialog", { name: copy.quota.trayTitle })).toBeInTheDocument();
    expect(ctx.bumpUsage).not.toHaveBeenCalled();
  });

  it("the empty state's Nova tarefa opens the classic composer", () => {
    const { chat, onCompose } = mount();
    fireEvent.click(within(chat).getByRole("button", { name: copy.composer.open }));
    expect(onCompose).toHaveBeenCalled();
  });
});

describe("MewChat on desktop", () => {
  afterEach(() => act(() => closePanel()));

  it("sending from the agenda dock opens the side panel, which then holds the only input", async () => {
    api.mewChat.mockResolvedValue({ reply: { reply: "Oi!", intent: "answer", blocks: [] } });
    render(
      <MemoryRouter>
        <MewChat panel onCompose={vi.fn()} />
        <PanelHost />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("complementary")).toBeNull();

    fireEvent.change(screen.getByRole("textbox", { name: t.open }), { target: { value: "oi" } });
    fireEvent.click(screen.getByRole("button", { name: t.send }));

    const side = await screen.findByRole("complementary", { name: copy.panel.mew });
    expect(await within(side).findByText("Oi!")).toBeInTheDocument();
    expect(api.mewChat).toHaveBeenCalledWith(expect.objectContaining({ text: "oi" }));
    expect(screen.queryByRole("textbox", { name: t.open })).toBeNull();
    expect(within(side).getByRole("textbox", { name: t.placeholder })).toHaveFocus();

    // Closed and reopened, the thread is still there.
    fireEvent.click(within(side).getByRole("button", { name: copy.panel.close }));
    expect(screen.getByRole("textbox", { name: t.open })).toBeInTheDocument();
    act(() => openPanel({ kind: "mew" }));
    expect(await within(screen.getByRole("complementary")).findByText("Oi!")).toBeInTheDocument();
  });
});
