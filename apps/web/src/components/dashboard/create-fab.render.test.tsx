/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const env = vi.hoisted(() => ({ desktop: true, voice: false, start: vi.fn() }));

vi.mock("@/components/dailifyContext", () => ({ useDailify: () => ({ hour12: false }) }));
// A voz fala com a API, rota e quotas; aqui só importa quem a liga.
vi.mock("@/hooks/useVoiceCreate", () => ({
  MAX_RECORDING_MS: 60_000,
  useVoiceCreate: () => ({ state: "idle", start: env.start, stop: vi.fn() }),
  voiceSupported: () => env.voice,
}));
vi.mock("@/hooks/useMewParse", () => ({
  useMewParse: () => ({
    pending: false,
    result: null,
    exhausted: false,
    remaining: null,
    ask: vi.fn(),
    reset: vi.fn(),
  }),
}));
vi.mock("@/hooks/useCreateTask", () => ({
  useCreateTask: () => ({ createMany: vi.fn(), submitting: false }),
}));
vi.mock("@/hooks/useIntegrations", () => ({ useCalendarReady: () => false }));
// The chat has its own render test; here only its two ways into the composer matter.
vi.mock("@/components/mew-chat/mew-chat", () => ({
  MewChat: ({ onCompose, onVoice }: { onCompose: () => void; onVoice?: () => void }) => (
    <>
      <button onClick={onCompose}>Nova tarefa</button>
      {onVoice && <button onClick={onVoice}>Falar com a Mewki</button>}
    </>
  ),
}));

import { CreateFab } from "./create-fab";

const setup = () => {
  const onSubmit = vi.fn().mockResolvedValue(true);
  render(<CreateFab onSubmit={onSubmit} />);
  // Radix modal põe pointer-events:none no body; sem isso o user-event recusa o unhover.
  return { onSubmit, user: userEvent.setup({ pointerEventsCheck: 0 }) };
};

beforeEach(() => {
  localStorage.clear();
  env.desktop = true;
  env.voice = false;
  env.start.mockClear();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: env.desktop,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
});

describe("<CreateFab> mobile", () => {
  beforeEach(() => {
    env.desktop = false;
  });

  it("o Nova tarefa do chat abre a folha com o campo focado; Cancelar fecha", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Nova tarefa" }));
    expect(screen.getByRole("dialog", { name: "Nova tarefa" })).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("⏎ cria e fecha; o modo fixo do desktop não vale aqui", async () => {
    localStorage.setItem("dailify:composer-docked", "1");
    const { user, onSubmit } = setup();
    expect(screen.queryByRole("region", { name: "Nova tarefa" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Nova tarefa" }));
    await user.keyboard("Comprar pão{Enter}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("o mic do dock abre a folha já gravando; sem voz, ele nem aparece", async () => {
    env.voice = true;
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Falar com a Mewki" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(env.start).toHaveBeenCalledTimes(1);

    cleanup();
    env.voice = false;
    setup();
    expect(screen.queryByRole("button", { name: "Falar com a Mewki" })).not.toBeInTheDocument();
  });
});

describe("<CreateFab> desktop", () => {
  it("Manter aberto fixa o campo, e o modo sobrevive a remontar", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Nova tarefa" }));
    await user.click(screen.getByRole("button", { name: "Manter aberto" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Nova tarefa" })).toContainElement(
      screen.getByRole("textbox"),
    );
    expect(localStorage.getItem("dailify:composer-docked")).toBe("1");

    cleanup();
    setup();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nova tarefa" })).not.toBeInTheDocument();
  });

  it("aberto: n foca o campo", async () => {
    localStorage.setItem("dailify:composer-docked", "1");
    const { user } = setup();

    await user.keyboard("n");
    expect(screen.getByRole("textbox")).toHaveFocus();
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("Minimizar desfixa mas deixa a folha aberta; sair com o mouse fecha", async () => {
    localStorage.setItem("dailify:composer-docked", "1");
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Minimizar" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(localStorage.getItem("dailify:composer-docked")).toBe("0");

    await user.hover(screen.getByRole("dialog"));
    await user.unhover(screen.getByRole("dialog"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nova tarefa" })).toBeInTheDocument();
  });

  it("desfixada com texto pela metade, sair com o mouse não fecha", async () => {
    localStorage.setItem("dailify:composer-docked", "1");
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Minimizar" }));
    await user.type(screen.getByRole("textbox"), "comprar");
    await user.hover(screen.getByRole("dialog"));
    await user.unhover(screen.getByRole("dialog"));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("aberta pelo +, sair com o mouse não fecha", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Nova tarefa" }));
    await user.hover(screen.getByRole("dialog"));
    await user.unhover(screen.getByRole("dialog"));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("aberto: enviar não some com o campo", async () => {
    localStorage.setItem("dailify:composer-docked", "1");
    const { onSubmit, user } = setup();

    await user.type(screen.getByRole("textbox"), "comprar pão{Enter}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("clicar abre a folha com o campo focado", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Nova tarefa" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveFocus();
  });

  it("n fora de um campo abre; Esc fecha", async () => {
    const { user } = setup();

    await user.keyboard("n");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("n dentro de um campo não abre", async () => {
    const { user } = setup();
    render(<input aria-label="outro" />);

    await user.type(screen.getByLabelText("outro"), "n");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("n com um menu aberto não abre", async () => {
    const { user } = setup();
    render(<div role="menu" />);

    await user.keyboard("n");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("⏎ cria e fecha", async () => {
    const { user, onSubmit } = setup();

    await user.click(screen.getByRole("button", { name: "Nova tarefa" }));
    await user.keyboard("Comprar pão{Enter}");

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ parsed: expect.objectContaining({ text: "Comprar pão" }) }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("⏎ que falha reabre a folha com o texto", async () => {
    const { user, onSubmit } = setup();
    onSubmit.mockResolvedValue(false);

    await user.click(screen.getByRole("button", { name: "Nova tarefa" }));
    await user.keyboard("Comprar pão amanhã{Enter}");

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("Comprar pão amanhã");
  });

  it("⇧⏎ cria, limpa o campo e mantém a folha aberta", async () => {
    const { user, onSubmit } = setup();

    await user.click(screen.getByRole("button", { name: "Nova tarefa" }));
    await user.keyboard("Comprar pão{Shift>}{Enter}{/Shift}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("mostra o destino: com horário vai para a Agenda; sem horário, A qualquer hora", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Nova tarefa" }));
    await user.keyboard("Reunião amanhã às 16h");
    expect(screen.getByRole("dialog")).toHaveTextContent("Vai para Agenda");

    await user.clear(screen.getByRole("textbox"));
    await user.keyboard("Regar as plantas toda quarta");
    expect(screen.getByRole("dialog")).toHaveTextContent("Vai para A qualquer hora · Recorrentes");
  });
});
