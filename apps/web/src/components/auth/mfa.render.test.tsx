/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/native-auth", () => ({
  verifySecondFactor: vi.fn(),
  sendSecondFactorEmail: vi.fn(),
}));

import { copy } from "./copy";
import { MfaChallenge } from "./mfa-challenge";
import { manualKey, MfaSetup } from "./mfa-setup";

const URI = "otpauth://totp/Mewki:ana%40x.com?secret=JBSWY3DPEHPK3PXP&issuer=Mewki";

describe("<MfaChallenge>", () => {
  const base = {
    kind: "totp" as const,
    busy: false,
    failure: null,
    onKind: vi.fn(),
    onSendEmail: vi.fn(),
  };

  it("sends the authenticator code with the 30-day trust box ticked", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<MfaChallenge {...base} showTrust onSubmit={onSubmit} />);

    expect(screen.getByRole("checkbox", { name: copy.mfa.trust })).toBeChecked();
    await user.type(screen.getByLabelText(/Código de 6 dígitos/), "123456");
    expect(onSubmit).toHaveBeenCalledWith("123456", true);
  });

  it("offers the e-mail and recovery codes, and no trust box in a step-up", async () => {
    const user = userEvent.setup();
    render(<MfaChallenge {...base} showTrust={false} onSubmit={vi.fn()} />);

    expect(screen.queryByRole("checkbox")).toBeNull();
    await user.click(screen.getByRole("button", { name: copy.mfa.useEmail }));
    expect(base.onSendEmail).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: copy.mfa.useBackup }));
    expect(base.onKind).toHaveBeenCalledWith("backup");
  });

  it("takes a recovery code as free text and shows a wrong one", () => {
    render(
      <MfaChallenge
        {...base}
        kind="backup"
        failure={{ key: "invalidCode" }}
        showTrust
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByRole("textbox", { name: copy.mfa.backupLabel })).toBeInTheDocument();
    expect(screen.getByText(copy.errors.invalidCode)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.mfa.useApp })).toBeInTheDocument();
  });
});

describe("<MfaSetup>", () => {
  const base = { uri: URI, onCopyKey: vi.fn(), onVerify: vi.fn(), busy: false, failure: null };

  it("on a phone opens the otpauth link and draws no QR code", () => {
    render(<MfaSetup {...base} mobile />);
    expect(screen.getByRole("link", { name: copy.mfaSetup.addAuto })).toHaveAttribute("href", URI);
    expect(screen.queryByRole("img", { name: copy.mfaSetup.qrLabel })).toBeNull();
  });

  it("in the app opens the link through the system", async () => {
    const user = userEvent.setup();
    const onOpenUri = vi.fn();
    render(<MfaSetup {...base} mobile onOpenUri={onOpenUri} />);
    await user.click(screen.getByRole("button", { name: copy.mfaSetup.addAuto }));
    expect(onOpenUri).toHaveBeenCalled();
  });

  it("on a computer shows the QR code instead, and the key copies unspaced", async () => {
    const user = userEvent.setup();
    render(<MfaSetup {...base} mobile={false} />);
    expect(screen.getByRole("img", { name: copy.mfaSetup.qrLabel })).toBeInTheDocument();
    expect(screen.queryByText(copy.mfaSetup.addAuto)).toBeNull();

    await user.click(screen.getByText(copy.mfaSetup.addManual));
    expect(screen.getByText("JBSW Y3DP EHPK 3PXP")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: copy.mfaSetup.copyKey }));
    expect(base.onCopyKey).toHaveBeenCalledWith("JBSWY3DPEHPK3PXP");
  });

  it("manualKey reads nothing from a URI without a secret", () => {
    expect(manualKey("otpauth://totp/Mewki:a")).toBe("");
  });
});
