/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
// The chat has its own render test; here only its way into the composer and the signal matter.
vi.mock("@/components/mew-chat/mew-chat", () => ({
  MewChat: ({ onCompose, listenSignal }: { onCompose: () => void; listenSignal?: number }) => (
    <>
      <button onClick={onCompose}>Nova tarefa</button>
      <output aria-label="listen signal">{listenSignal ?? 0}</output>
    </>
  ),
}));

import { copy as kitCopy } from "@/components/kit/copy";

import { copy } from "./copy";
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

    await user.click(screen.getByRole("button", { name: copy.composer.open }));
    expect(screen.getByRole("dialog", { name: copy.composer.open })).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveFocus();

    await user.click(screen.getByRole("button", { name: kitCopy.cancel }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("⏎ cria e fecha", async () => {
    const { user, onSubmit } = setup();

    await user.click(screen.getByRole("button", { name: copy.composer.open }));
    await user.keyboard("Comprar pão{Enter}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("text opens the sheet already holding it", () => {
    render(<CreateFab onSubmit={vi.fn()} text="dentista amanhã" />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("dentista amanhã");
  });

  it("the voice signal (Android assistant) goes to the Mew chat, not the composer", () => {
    env.voice = true;
    render(<CreateFab onSubmit={vi.fn()} voiceSignal={1} />);
    expect(screen.getByLabelText("listen signal")).toHaveTextContent("1");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(env.start).not.toHaveBeenCalled();
  });
});

describe("<CreateFab> desktop", () => {
  it("the toolbar signal opens the titled dialog; Cancelar closes it", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const { rerender } = render(<CreateFab onSubmit={vi.fn()} openSignal={0} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    rerender(<CreateFab onSubmit={vi.fn()} openSignal={1} />);
    expect(screen.getByRole("dialog", { name: copy.composer.open })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: copy.composer.open })).toBeVisible();

    await user.click(screen.getByRole("button", { name: kitCopy.cancel }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("a calendar day opens the dialog on that day", () => {
    render(<CreateFab onSubmit={vi.fn()} day={new Date(2026, 10, 20)} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("/ focuses the Mew input instead of opening the composer", async () => {
    const { user } = setup();
    render(<input id="mew-input" aria-label="mew" />);

    await user.keyboard("/");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("mew")).toHaveFocus();
  });

  it("clicar abre a folha com o campo focado", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: copy.composer.open }));

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

    await user.click(screen.getByRole("button", { name: copy.composer.open }));
    await user.keyboard("Comprar pão{Enter}");

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ parsed: expect.objectContaining({ text: "Comprar pão" }) }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("⏎ que falha reabre a folha com o texto", async () => {
    const { user, onSubmit } = setup();
    onSubmit.mockResolvedValue(false);

    await user.click(screen.getByRole("button", { name: copy.composer.open }));
    await user.keyboard("Comprar pão amanhã{Enter}");

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("Comprar pão amanhã");
  });

  it("⇧⏎ cria, limpa o campo e mantém a folha aberta", async () => {
    const { user, onSubmit } = setup();

    await user.click(screen.getByRole("button", { name: copy.composer.open }));
    await user.keyboard("Comprar pão{Shift>}{Enter}{/Shift}");

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("mostra o destino: com horário vai para a Agenda; sem horário, A qualquer hora", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: copy.composer.open }));
    await user.keyboard("Reunião amanhã às 16h");
    expect(screen.getByRole("dialog")).toHaveTextContent("Vai para Agenda");

    await user.clear(screen.getByRole("textbox"));
    await user.keyboard("Regar as plantas toda quarta");
    expect(screen.getByRole("dialog")).toHaveTextContent("Vai para A qualquer hora · Recorrentes");
  });
});
