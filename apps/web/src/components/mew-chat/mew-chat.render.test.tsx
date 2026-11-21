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
  sendMewAction: vi.fn(),
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

const asksToRead: MewReply = {
  reply: "Posso olhar o canal?",
  intent: "answer",
  blocks: [
    {
      kind: "permission",
      id: "p1",
      provider: "google-calendar",
      capability: "read",
      target: "C1",
      label: "#geral",
    },
  ],
};
const drafted: MewReply = {
  reply: "Rascunho:",
  intent: "answer",
  blocks: [
    {
      kind: "send",
      id: "d1",
      provider: "google-calendar",
      target: "C1",
      to: "#geral",
      text: "Já vi!",
    },
  ],
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

  it.each([
    [t.readBox.once, false],
    [t.readBox.always, true],
  ])("%s re-sends the same turn with the permission and shows her answer", async (name, always) => {
    api.mewChat
      .mockResolvedValueOnce({ reply: asksToRead })
      // One word: the reply renders a span per word.
      .mockResolvedValueOnce({ reply: { reply: "Respondeu.", intent: "answer", blocks: [] } });
    const { chat } = mount();
    say("o João respondeu?");
    fireEvent.click(await within(chat).findByRole("button", { name }));

    expect(await within(chat).findByText("Respondeu.")).toBeInTheDocument();
    expect(api.mewChat).toHaveBeenLastCalledWith(
      expect.objectContaining({
        text: "o João respondeu?",
        history: [],
        permission: { id: "p1", always },
      }),
    );
    expect(within(chat).getByText("Permitido: #geral")).toBeInTheDocument();
    // One credit for the whole turn.
    expect(ctx.bumpUsage).toHaveBeenCalledTimes(1);
  });

  it("Não permitir cancels without asking the server again", async () => {
    api.mewChat.mockResolvedValue({ reply: asksToRead });
    const { chat } = mount();
    say("o João respondeu?");
    fireEvent.click(await within(chat).findByRole("button", { name: t.readBox.deny }));
    expect(await within(chat).findByText("Tudo bem, não vou ler #geral.")).toBeInTheDocument();
    expect(api.setMewAction).toHaveBeenCalledWith("p1", "cancelled");
    expect(api.mewChat).toHaveBeenCalledTimes(1);
  });

  it("a send box sends the draft, or the edited text, only on Enviar", async () => {
    api.mewChat.mockResolvedValue({ reply: drafted });
    api.sendMewAction.mockResolvedValue({});
    const { chat } = mount();
    say("responde o João");
    fireEvent.click(await within(chat).findByRole("button", { name: t.sendBox.edit }));
    fireEvent.change(within(chat).getByRole("textbox", { name: t.sendBox.text }), {
      target: { value: "Revisado!" },
    });
    expect(api.sendMewAction).not.toHaveBeenCalled();
    fireEvent.click(within(chat).getByRole("button", { name: t.sendBox.send }));
    await waitFor(() => expect(api.sendMewAction).toHaveBeenCalledWith("d1", "Revisado!"));
    expect(await within(chat).findByText("Enviado para #geral")).toBeInTheDocument();
  });

  it("a refused send puts the box back with its text", async () => {
    api.mewChat.mockResolvedValue({ reply: drafted });
    api.sendMewAction.mockResolvedValue({ error: { message: "x", offline: false, status: 502 } });
    const { chat } = mount();
    say("responde o João");
    fireEvent.click(await within(chat).findByRole("button", { name: t.sendBox.send }));
    await waitFor(() => expect(api.sendMewAction).toHaveBeenCalledWith("d1", "Já vi!"));
    expect(await within(chat).findByRole("button", { name: t.sendBox.send })).toBeInTheDocument();
  });

  it("Cancelar on a send box sends nothing", async () => {
    api.mewChat.mockResolvedValue({ reply: drafted });
    const { chat } = mount();
    say("responde o João");
    fireEvent.click(await within(chat).findByRole("button", { name: t.sendBox.cancel }));
    expect(await within(chat).findByText(t.sendBox.cancelled)).toBeInTheDocument();
    expect(api.setMewAction).toHaveBeenCalledWith("d1", "cancelled");
    expect(api.sendMewAction).not.toHaveBeenCalled();
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
        <PanelHost onCreateOn={vi.fn()} onOpenDay={vi.fn()} />
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
