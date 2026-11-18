/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { copy } from "@/components/dashboard/copy";

const push = vi.hoisted(() => ({ pushState: vi.fn(), enablePush: vi.fn(), disablePush: vi.fn() }));
const toast = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("@/functions/push", () => push);
vi.mock("sonner", () => ({ toast }));

import { PushToggle } from "./push-toggle";

const toggle = () => screen.findByRole("switch", { name: copy.profile.pushTitle });

beforeEach(() => vi.resetAllMocks());

describe("<PushToggle>", () => {
  it("shows no switch while the device state loads", () => {
    push.pushState.mockReturnValue(new Promise(() => {}));
    render(<PushToggle />);
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it.each([
    ["unsupported", copy.form.notificationsUnsupported],
    ["denied", copy.form.notificationsDenied],
  ])("%s: explains instead of offering a switch", async (state, text) => {
    push.pushState.mockResolvedValue(state);
    render(<PushToggle />);
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(screen.queryByRole("switch")).toBeNull();
  });

  it("on: the switch is checked and turning it off disables push", async () => {
    push.pushState.mockResolvedValue("on");
    push.disablePush.mockResolvedValue("off");
    render(<PushToggle />);
    const sw = await toggle();
    expect(sw).toHaveAttribute("aria-checked", "true");
    await userEvent.click(sw);
    expect(push.disablePush).toHaveBeenCalled();
    expect(await toggle()).toHaveAttribute("aria-checked", "false");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("off: enabling that ends still off toasts the error", async () => {
    push.pushState.mockResolvedValue("off");
    push.enablePush.mockResolvedValue("off");
    render(<PushToggle />);
    await userEvent.click(await toggle());
    expect(push.enablePush).toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(copy.form.notificationsError);
  });
});
