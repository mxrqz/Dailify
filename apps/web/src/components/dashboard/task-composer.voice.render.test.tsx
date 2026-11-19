/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import { copy } from "./copy";

// Aqui a voz é de verdade: só o navegador (MediaRecorder, microfone, Web Audio) e a rede são falsos.
const api = vi.hoisted(() => ({ createTaskVoice: vi.fn(), parseTaskAi: vi.fn() }));
const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), message: vi.fn() }),
);
const ctx = vi.hoisted(() => ({ aiUsed: 0 }));
const prefs = vi.hoisted(() => ({ reduce: false }));

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
vi.mock("motion/react", async (original) => ({
  ...(await original<typeof import("motion/react")>()),
  useReducedMotion: () => prefs.reduce,
}));

import { CreditsTray } from "@/components/credits-tray";
import { setCreditsTray } from "@/hooks/useCreditsTray";
import { TaskComposer } from "./task-composer";

const track = { stop: vi.fn() };
const stream = { getTracks: () => [track] };
const getUserMedia = vi.fn();
const readWave = vi.fn((samples: Uint8Array) => samples.fill(192));

class FakeRecorder {
  static isTypeSupported = () => true;
  mimeType = "audio/webm";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  start() {}
  stop() {
    this.ondataavailable?.({ data: new Blob(["fala"]) });
    this.onstop?.();
  }
}

class FakeAudio {
  createAnalyser = () => ({ fftSize: 0, getByteTimeDomainData: readWave });
  createMediaStreamSource = () => ({ connect: () => {} });
  close = async () => {};
}

const setup = () => {
  render(
    <MemoryRouter>
      <TaskComposer onSubmit={vi.fn().mockResolvedValue(true)} />
      <CreditsTray />
    </MemoryRouter>,
  );
  return userEvent.setup();
};

beforeEach(() => {
  setCreditsTray(false);
  ctx.aiUsed = 0;
  prefs.reduce = false;
  vi.stubGlobal("MediaRecorder", FakeRecorder);
  vi.stubGlobal("AudioContext", FakeAudio);
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  getUserMedia.mockResolvedValue(stream);
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
});

describe("<TaskComposer> gravador", () => {
  it("gravando mostra a onda; parar envia e põe as tarefas na tela", async () => {
    api.createTaskVoice.mockResolvedValue({
      tasks: [{ id: "t1", title: "Dentista", undated: true, completed: [] }],
    });
    const user = setup();
    await user.click(screen.getByRole("button", { name: copy.voice.record }));

    expect(screen.getByRole("img", { name: copy.voice.wave })).toBeInTheDocument();
    await waitFor(() => expect(readWave).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: copy.voice.stop }));
    expect(api.createTaskVoice).toHaveBeenCalledTimes(1);
    expect(track.stop).toHaveBeenCalled();
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(copy.voice.createdOne, expect.anything()),
    );
    expect(screen.queryByRole("img", { name: copy.voice.wave })).not.toBeInTheDocument();
  });

  it("while the server transcribes, the stop button turns into a busy Entendendo…", async () => {
    let reply: (value: { tasks: [] }) => void = () => {};
    api.createTaskVoice.mockReturnValue(new Promise((resolve) => (reply = resolve)));
    const user = setup();
    await user.click(screen.getByRole("button", { name: copy.voice.record }));
    await user.click(screen.getByRole("button", { name: copy.voice.stop }));

    const wait = screen.getByRole("button", { name: copy.voice.understanding });
    expect(wait).toBeDisabled();
    expect(wait).toHaveAttribute("aria-busy", "true");
    reply({ tasks: [] });
    await waitFor(() => expect(toast.message).toHaveBeenCalled());
  });

  it("cancelar solta o microfone e não envia", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: copy.voice.record }));
    await user.click(screen.getByRole("button", { name: copy.voice.cancel }));

    expect(track.stop).toHaveBeenCalled();
    expect(api.createTaskVoice).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: copy.voice.record })).toBeEnabled();
    expect(screen.queryByRole("img", { name: copy.voice.wave })).not.toBeInTheDocument();
  });

  it("microfone negado: avisa e continua parado", async () => {
    getUserMedia.mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    const user = setup();
    await user.click(screen.getByRole("button", { name: copy.voice.record }));

    expect(toast.error).toHaveBeenCalledWith(copy.voice.micDenied, {
      description: copy.voice.micDeniedHint,
    });
    expect(screen.getByRole("button", { name: copy.voice.record })).toBeInTheDocument();
  });

  it("sem créditos: sobe a bandeja do upgrade e nem pede o microfone", async () => {
    ctx.aiUsed = 30;
    const user = setup();
    await user.click(screen.getByRole("button", { name: copy.voice.record }));

    const tray = await screen.findByRole("alertdialog", { name: copy.quota.trayTitle });
    expect(within(tray).getByRole("button", { name: copy.quota.trayUpgrade })).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("offline, o mic não aparece", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    setup();
    expect(screen.queryByRole("button", { name: copy.voice.record })).not.toBeInTheDocument();
  });

  it("movimento reduzido: a onda fica parada", async () => {
    prefs.reduce = true;
    const user = setup();
    await user.click(screen.getByRole("button", { name: copy.voice.record }));

    expect(screen.getByRole("img", { name: copy.voice.wave })).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(readWave).not.toHaveBeenCalled();
  });
});
