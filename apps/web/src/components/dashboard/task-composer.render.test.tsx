/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { copy } from "./copy";

const voice = vi.hoisted(() => ({ state: "idle", start: vi.fn(), stop: vi.fn() }));
vi.mock("@/components/dailifyContext", () => ({ useDailify: () => ({ hour12: false }) }));
vi.mock("@/hooks/useVoiceCreate", () => ({
  useVoiceCreate: () => voice,
  voiceSupported: () => true,
}));

import { TaskComposer } from "./task-composer";

describe("<TaskComposer> voz", () => {
  it("parado, o mic começa a gravar", async () => {
    voice.state = "idle";
    render(<TaskComposer onSubmit={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: copy.voice.record }));
    expect(voice.start).toHaveBeenCalled();
  });

  it("gravando, o campo vira o aviso e o mic para", async () => {
    voice.state = "recording";
    render(<TaskComposer onSubmit={vi.fn()} />);
    expect(screen.getByPlaceholderText(copy.voice.listening)).toHaveAttribute("readonly");
    expect(screen.getByRole("button", { name: copy.composer.submit })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: copy.voice.stop }));
    expect(voice.stop).toHaveBeenCalled();
  });
});
