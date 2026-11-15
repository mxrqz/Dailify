/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { AiParse, ParsedTaskWire } from "@dailify/shared";

import { zonedAt } from "@/functions/zone";
import { copy } from "./copy";

const voice = vi.hoisted(() => ({ state: "idle", start: vi.fn(), stop: vi.fn() }));
const api = vi.hoisted(() => ({
  parseTaskAi: vi.fn(),
  createTask: vi.fn(),
  deleteTask: vi.fn(),
}));
const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), message: vi.fn() }),
);
const ctx = vi.hoisted(() => ({ aiUsed: 5 }));

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({ getToken: async () => "token", userId: "u1" }),
}));
vi.mock("@/components/dailifyContext", () => ({
  useDailify: () => ({
    hour12: false,
    quotas: { limits: { tasks: -1, ai: 30 }, usage: { tasks: 0, ai: ctx.aiUsed } },
    bumpUsage: vi.fn(),
    tasks: [],
    setTasks: vi.fn(),
    undatedTasks: [],
    setUndatedTasks: vi.fn(),
    loadedMonths: [],
  }),
}));
vi.mock("@/functions/api", () => api);
vi.mock("sonner", () => ({ toast }));
vi.mock("@/hooks/useVoiceCreate", () => ({
  useVoiceCreate: () => voice,
  voiceSupported: () => true,
}));

import { TaskComposer } from "./task-composer";

const QUESTION = "o que tenho amanhã?";
const improveDiscreet = `${copy.mew.improve} · 25 restantes`;

const setup = () => {
  const onSubmit = vi.fn();
  render(
    <MemoryRouter>
      <TaskComposer onSubmit={onSubmit} />
    </MemoryRouter>,
  );
  return { onSubmit, user: userEvent.setup() };
};

const draft = (text: string, hour: number): ParsedTaskWire => ({
  text,
  date: zonedAt(2030, 0, 10, hour).getTime(),
  hasTime: true,
  hasDay: true,
  duration: null,
  links: [],
  repeat: "Off",
});
const reads = (result: AiParse) => api.parseTaskAi.mockResolvedValue({ result });

beforeEach(() => {
  vi.clearAllMocks();
  voice.state = "idle";
  ctx.aiUsed = 5;
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
});

describe("<TaskComposer> voz", () => {
  it("parado, o mic começa a gravar", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: copy.voice.record }));
    expect(voice.start).toHaveBeenCalled();
  });

  it("gravando, o campo vira o aviso e o mic para", async () => {
    voice.state = "recording";
    const { user } = setup();
    expect(screen.getByPlaceholderText(copy.voice.listening)).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: copy.composer.submit })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: copy.voice.stop }));
    expect(voice.stop).toHaveBeenCalled();
  });
});

describe("<TaskComposer> Melhorar com a Mew", () => {
  it("com dúvida, o botão vem com o porquê e os créditos; confiante, fica discreto", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("textbox"), QUESTION);
    expect(screen.getByRole("button", { name: copy.mew.improve })).toBeEnabled();
    expect(screen.getByText(copy.mew.unsure.question)).toBeInTheDocument();
    expect(screen.getByText("25 restantes")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: improveDiscreet })).not.toBeInTheDocument();

    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "comprar pão");
    expect(screen.queryByText(copy.mew.unsure.question)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: improveDiscreet })).toBeEnabled();
  });

  it("sem créditos: desativado, com o caminho pro /premium", async () => {
    ctx.aiUsed = 30;
    const { user } = setup();
    await user.type(screen.getByRole("textbox"), QUESTION);
    expect(screen.getByRole("button", { name: copy.mew.improve })).toBeDisabled();
    expect(
      screen.getByRole("link", { name: `${copy.mew.exhausted} · ${copy.mew.upgrade}` }),
    ).toHaveAttribute("href", "/premium");
  });

  it("offline, não aparece", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const { user } = setup();
    await user.type(screen.getByRole("textbox"), QUESTION);
    expect(screen.queryByRole("button", { name: copy.mew.improve })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: improveDiscreet })).not.toBeInTheDocument();
  });

  it("um rascunho troca os chips e o Enter cria ele; editar volta pro parser local", async () => {
    reads({ reply: "", intent: "create", drafts: [draft("Dentista", 15)] });
    const { user, onSubmit } = setup();
    await user.type(screen.getByRole("textbox"), "dentista dps do almoço");
    await user.click(screen.getByRole("button", { name: improveDiscreet }));

    expect(api.parseTaskAi).toHaveBeenCalledWith("token", "dentista dps do almoço");
    expect(screen.getByRole("img", { name: copy.mew.draft })).toBeInTheDocument();
    expect(screen.getByText("15:00")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("dentista dps do almoço");

    await user.type(screen.getByRole("textbox"), "!");
    expect(screen.queryByRole("img", { name: copy.mew.draft })).not.toBeInTheDocument();
    expect(screen.queryByText("15:00")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: improveDiscreet }));
    await user.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ parsed: expect.objectContaining({ text: "Dentista" }) }),
      false,
    );
  });

  it("vários rascunhos: lista pra confirmar, e confirmar cria todos com Desfazer", async () => {
    reads({ reply: "", intent: "create", drafts: [draft("Pão", 9), draft("Leite", 10)] });
    api.createTask.mockImplementation(async (_token, input) => ({
      task: { ...input, completed: [] },
    }));
    const { user, onSubmit } = setup();
    await user.type(screen.getByRole("textbox"), "comprar pão às 9 e leite às 10");
    await user.click(screen.getByRole("button", { name: copy.mew.improve }));

    const list = screen.getByRole("list", { name: copy.mew.drafts });
    expect(list).toHaveTextContent("Pão");
    expect(list).toHaveTextContent("Leite");

    await user.click(screen.getByRole("button", { name: "Criar 2 tarefas" }));
    expect(api.createTask).toHaveBeenCalledTimes(2);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(
      "2 tarefas criadas",
      expect.objectContaining({ action: expect.objectContaining({ label: copy.task.undo }) }),
    );
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("pergunta: mostra a resposta da Mew e não cria nada", async () => {
    reads({ reply: "Ainda não leio a sua agenda.", intent: "question", drafts: [] });
    const { user, onSubmit } = setup();
    await user.type(screen.getByRole("textbox"), QUESTION);
    await user.click(screen.getByRole("button", { name: copy.mew.improve }));

    expect(screen.getByRole("status")).toHaveTextContent("Ainda não leio a sua agenda.");
    expect(screen.getByRole("textbox")).toHaveValue(QUESTION);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(api.createTask).not.toHaveBeenCalled();
  });

  it("502: avisa que nenhum crédito foi usado", async () => {
    api.parseTaskAi.mockResolvedValue({
      error: { message: "AI request failed", offline: false, status: 502 },
    });
    const { user } = setup();
    await user.type(screen.getByRole("textbox"), QUESTION);
    await user.click(screen.getByRole("button", { name: copy.mew.improve }));

    expect(toast.error).toHaveBeenCalledWith(copy.mew.failed, { description: copy.mew.noCredit });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
