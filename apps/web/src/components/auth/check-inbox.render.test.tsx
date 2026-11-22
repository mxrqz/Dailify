/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { AuthFailure } from "./auth-state";
import { CheckInbox } from "./check-inbox";
import { copy } from "./copy";

const mount = (onCode: (code: string) => Promise<AuthFailure | null>) =>
  render(
    <CheckInbox
      email="ana@x.com"
      sentAt={Date.now()}
      onResend={() => {}}
      onBack={() => {}}
      onCode={onCode}
    />,
  );

describe("<CheckInbox> code entry", () => {
  it("sends the typed code and stays busy while the session lands", async () => {
    const user = userEvent.setup();
    const onCode = vi.fn(() => Promise.resolve(null));
    mount(onCode);

    await user.type(screen.getByLabelText(copy.inbox.codeLabel), "123456");
    await user.click(screen.getByRole("button", { name: copy.inbox.codeSubmit }));

    expect(onCode).toHaveBeenCalledWith("123456");
    expect(screen.getByRole("button", { name: copy.inbox.codeSubmit })).toBeDisabled();
    expect(screen.queryByText(copy.errors.invalidCode)).not.toBeInTheDocument();
  });

  it("shows a wrong code's error on the field and lets the user try again", async () => {
    const user = userEvent.setup();
    const onCode = vi.fn(() => Promise.resolve<AuthFailure>({ key: "invalidCode" }));
    mount(onCode);

    const field = screen.getByLabelText(copy.inbox.codeLabel);
    await user.type(field, "000000{Enter}");

    expect(await screen.findByText(copy.errors.invalidCode)).toBeInTheDocument();
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: copy.inbox.codeSubmit })).toBeEnabled();
  });
});
