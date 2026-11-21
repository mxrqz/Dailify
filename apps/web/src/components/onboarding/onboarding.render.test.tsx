/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.hoisted(() => ({ pushState: vi.fn(), enablePush: vi.fn() }));
const native = vi.hoisted(() => ({
  nativeReminders: vi.fn(() => false),
  openAssistantSettings: vi.fn(),
}));
vi.mock("@/functions/push", () => push);
vi.mock("@/lib/reminders", () => native);

import { copy } from "./copy";
import { ONBOARDING_KEY, Onboarding } from "./onboarding";

const dialog = (step: keyof typeof copy.steps) =>
  screen.findByRole("dialog", { name: copy.steps[step].title });
const tap = (name: string) => userEvent.click(screen.getByRole("button", { name }));

beforeEach(() => {
  localStorage.clear();
  push.pushState.mockResolvedValue("off");
  push.enablePush.mockResolvedValue("on");
  native.nativeReminders.mockReturnValue(false);
  native.openAssistantSettings.mockResolvedValue(undefined);
});

describe("<Onboarding>", () => {
  it("shows once per device and not again", async () => {
    const first = render(<Onboarding onTry={vi.fn()} />);
    await dialog("welcome");
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe("1");
    first.unmount();

    render(<Onboarding onTry={vi.fn()} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("waits, unspent, while a deep-link intent holds it", () => {
    render(<Onboarding onTry={vi.fn()} hold />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(localStorage.getItem(ONBOARDING_KEY)).toBeNull();
  });

  it("Pular closes it and leaves it seen", async () => {
    render(<Onboarding onTry={vi.fn()} />);
    await dialog("welcome");
    await tap(copy.skip);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe("1");
  });

  it("Agora não skips only the reminders step", async () => {
    render(<Onboarding onTry={vi.fn()} />);
    await tap(copy.start);
    await tap(copy.next);
    await tap(copy.next);
    await dialog("notifications");
    await tap(copy.notNow);
    expect(await dialog("done")).toBeInTheDocument();
    expect(push.enablePush).not.toHaveBeenCalled();
  });

  it("enabling reminders moves on whatever the result", async () => {
    push.enablePush.mockRejectedValue(new Error("no sw"));
    render(<Onboarding onTry={vi.fn()} />);
    await tap(copy.start);
    await tap(copy.next);
    await tap(copy.next);
    await tap(copy.enableNotifications);
    expect(push.enablePush).toHaveBeenCalled();
    expect(await dialog("done")).toBeInTheDocument();
  });

  it("hides the reminders step when they are already on, and counts only shown steps", async () => {
    push.pushState.mockResolvedValue("on");
    render(<Onboarding onTry={vi.fn()} />);
    expect(await screen.findByRole("img", { name: "Passo 1 de 4" })).toBeInTheDocument();
    await tap(copy.start);
    await tap(copy.next);
    await tap(copy.next);
    expect(await dialog("done")).toBeInTheDocument();
  });

  it("shows the assistant step only in the Android app, opening the system picker", async () => {
    native.nativeReminders.mockReturnValue(true);
    push.pushState.mockResolvedValue("on");
    render(<Onboarding onTry={vi.fn()} />);
    expect(await screen.findByRole("img", { name: "Passo 1 de 5" })).toBeInTheDocument();
    await tap(copy.start);
    await tap(copy.next);
    await tap(copy.next);
    await dialog("assistant");
    await tap(copy.useAssistant);
    expect(native.openAssistantSettings).toHaveBeenCalled();
    expect(await dialog("done")).toBeInTheDocument();
  });

  it("a suggestion closes it and hands its text over", async () => {
    push.pushState.mockResolvedValue("on");
    const onTry = vi.fn();
    render(<Onboarding onTry={onTry} />);
    await tap(copy.start);
    await tap(copy.next);
    await tap(copy.next);
    await tap(copy.suggestions[0]);
    expect(onTry).toHaveBeenCalledWith(copy.suggestions[0]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
