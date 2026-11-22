/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { AiParse, ParsedTaskWire } from "@dailify/shared";

import { fill } from "@/functions/functions";
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

vi.mock("@/lib/auth", () => ({
  useSession: () => ({ data: { user: { id: "u1" } }, isPending: false }),
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
  MAX_RECORDING_MS: 60_000,
  useVoiceCreate: () => voice,
  voiceSupported: () => true,
}));

import { TaskComposer } from "./task-composer";

const QUESTION = "o que tenho amanhã?";

const setup = () => {
  const onSubmit = vi.fn().mockResolvedValue(true);
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

  it("gravando, a folha vira a Mew ouvindo e o Parar e criar para", async () => {
    voice.state = "recording";
    const { user } = setup();
    expect(screen.getByText(copy.voice.listening)).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: copy.voice.stop }));
    expect(voice.stop).toHaveBeenCalled();
  });
});

describe("<TaskComposer> criação recusada", () => {
  it("limpa na hora e devolve o texto quando o create falha", async () => {
    const { user, onSubmit } = setup();
    onSubmit.mockResolvedValue(false);
    await user.type(screen.getByRole("textbox"), "pagar luz amanhã{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(await screen.findByDisplayValue("pagar luz amanhã")).toBeInTheDocument();
  });
});

describe("<TaskComposer> Melhorar com a Mew", () => {
  it("com dúvida, o cartão diz o porquê junto dos créditos; confiante, só os créditos", async () => {
    const { user } = setup();
    expect(screen.getByRole("button", { name: copy.mew.improve })).toBeDisabled();
    await user.type(screen.getByRole("textbox"), QUESTION);
    const card = screen.getByRole("button", { name: copy.mew.improve });
    expect(card).toBeEnabled();
    expect(card).toHaveAccessibleDescription(/^Parece uma pergunta.*25 restantes$/);
    expect(screen.getByText("25 restantes")).toBeInTheDocument();

    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "comprar pão");
    expect(screen.queryByText(copy.mew.unsure.question)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.mew.improve })).toHaveAccessibleDescription(
      "25 restantes",
    );
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
  });

  it("um rascunho troca os chips e o Enter cria ele; editar volta pro parser local", async () => {
    reads({ reply: "", intent: "create", drafts: [draft("Dentista", 15)] });
    const { user, onSubmit } = setup();
    await user.type(screen.getByRole("textbox"), "dentista dps do almoço");
    await user.click(screen.getByRole("button", { name: copy.mew.improve }));

    expect(api.parseTaskAi).toHaveBeenCalledWith("dentista dps do almoço");
    expect(screen.getByRole("img", { name: copy.mew.draft })).toBeInTheDocument();
    expect(screen.getByText("15:00")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("dentista dps do almoço");

    await user.type(screen.getByRole("textbox"), "!");
    expect(screen.queryByRole("img", { name: copy.mew.draft })).not.toBeInTheDocument();
    expect(screen.queryByText("15:00")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: copy.mew.improve }));
    await user.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ parsed: expect.objectContaining({ text: "Dentista" }) }),
      false,
    );
  });

  it("vários rascunhos: lista pra confirmar, e confirmar cria todos com Desfazer", async () => {
    reads({ reply: "", intent: "create", drafts: [draft("Pão", 9), draft("Leite", 10)] });
    api.createTask.mockImplementation(async (input) => ({
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

describe("<TaskComposer> marcas no texto", () => {
  // O espelho é aria-hidden: não há papel acessível, então vai pelo elemento.
  const marks = () => [...document.querySelectorAll("mark")].map((mark) => mark.textContent);

  it("sublinha o que foi lido, acompanha a digitação, e o trecho de chip tirado não marca", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("textbox"), "pagar luz amanhã");
    expect(marks()).toEqual(["amanhã"]);

    await user.type(screen.getByRole("textbox"), " às 15h");
    expect(marks()).toEqual(["amanhã", "às 15h"]);

    await user.click(screen.getByRole("button", { name: copy.composer.removeDay }));
    expect(marks()).toEqual(["às 15h"]);
  });
});

describe("<TaskComposer> chips", () => {
  const submitted = (onSubmit: ReturnType<typeof vi.fn>) => onSubmit.mock.calls[0][0].parsed;

  it("tirar um chip devolve as palavras ao título, e digitar em outro lugar não as lê de novo", async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByRole("textbox"), "pagar luz amanhã");
    await user.click(screen.getByRole("button", { name: copy.composer.removeDay }));

    expect(screen.getByRole("textbox")).toHaveFocus();
    expect(screen.getByText(copy.composer.addDay)).toBeInTheDocument();
    await user.type(screen.getByRole("textbox"), " cedo");
    expect(screen.queryByRole("button", { name: copy.composer.removeDay })).not.toBeInTheDocument();

    await user.keyboard("{Enter}");
    expect(submitted(onSubmit)).toMatchObject({ text: "pagar luz amanhã cedo", hasDay: false });
  });

  it("reads #tags into chips, and removing one puts its word back in the title", async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByRole("textbox"), "academia #saúde #Treino");
    expect(
      screen.getByRole("button", { name: fill(copy.composer.tag, { tag: "saúde" }) }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: fill(copy.composer.removeTag, { tag: "Treino" }) }),
    );
    await user.keyboard("{Enter}");
    expect(submitted(onSubmit)).toMatchObject({ text: "academia #Treino", tags: ["saúde"] });
  });

  it("Backspace no chip tira; editar dentro do trecho volta a ler", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("textbox"), "pagar luz amanhã");
    screen.getByRole("button", { name: /^Editar dia:/ }).focus();
    await user.keyboard("{Backspace}");
    expect(screen.queryByRole("button", { name: copy.composer.removeDay })).not.toBeInTheDocument();

    await user.type(screen.getByRole("textbox"), "{Backspace}ã");
    expect(screen.getByRole("button", { name: copy.composer.removeDay })).toBeInTheDocument();
  });

  it("tocar no chip edita: o valor escolhido vale e as palavras seguem fora do título", async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByRole("textbox"), "call de 1h");
    await user.click(
      screen.getByRole("button", { name: copy.composer.editDuration.replace("{value}", "1h") }),
    );
    await user.click(await screen.findByRole("menuitemradio", { name: "30m" }));

    expect(
      screen.getByRole("button", { name: copy.composer.editDuration.replace("{value}", "30m") }),
    ).toBeInTheDocument();
    screen.getByRole("textbox").focus();
    await user.keyboard("{Enter}");
    expect(submitted(onSubmit)).toMatchObject({ text: "call", duration: "30m" });
  });

  it("the reminder chip of a task with a time picks an offset and submits it", async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByRole("textbox"), "dentista amanhã 15h");
    await user.click(screen.getByRole("button", { name: copy.composer.addReminder }));
    await user.click(
      await screen.findByRole("menuitemradio", { name: copy.form.reminderOffsets[30] }),
    );

    const label = copy.composer.editReminder.replace("{value}", copy.form.reminderOffsets[30]);
    expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    screen.getByRole("textbox").focus();
    await user.keyboard("{Enter}");
    expect(onSubmit.mock.lastCall?.[0]).toMatchObject({ before: 30 });
  });

  it("intervalo: o chip diz a cada quanto, e o menu troca o N", async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByRole("textbox"), "faxina a cada 2 semanas na segunda");
    const label = (value: string) => copy.composer.editRepeat.replace("{value}", value);
    await user.click(screen.getByRole("button", { name: label("A cada 2 semanas (seg)") }));
    await user.click(await screen.findByRole("menuitemradio", { name: "A cada 3 semanas" }));

    expect(
      screen.getByRole("button", { name: label("A cada 3 semanas (seg)") }),
    ).toBeInTheDocument();
    screen.getByRole("textbox").focus();
    await user.keyboard("{Enter}");
    expect(submitted(onSubmit)).toMatchObject({
      text: "faxina",
      repeat: { Weekly: ["Monday"] },
      repeatEvery: 3,
    });
  });

  it("entre aspas é literal e as aspas saem do título", async () => {
    const { user, onSubmit } = setup();
    await user.type(screen.getByRole("textbox"), 'ler "amanhã é outro dia"');
    expect(screen.getByText(copy.composer.addDay)).toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(submitted(onSubmit)).toMatchObject({ text: "ler amanhã é outro dia", hasDay: false });
  });

  it("rascunho da Mew: tirar o chip só zera o campo", async () => {
    reads({ reply: "", intent: "create", drafts: [draft("Dentista", 15)] });
    const { user, onSubmit } = setup();
    await user.type(screen.getByRole("textbox"), "dentista dps do almoço");
    await user.click(screen.getByRole("button", { name: copy.mew.improve }));
    await user.click(screen.getByRole("button", { name: copy.composer.removeTime }));

    expect(screen.queryByText("15:00")).not.toBeInTheDocument();
    await user.keyboard("{Enter}");
    expect(submitted(onSubmit)).toMatchObject({ text: "Dentista", hasTime: false, hasDay: true });
  });
});
