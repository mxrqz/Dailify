/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HelmetProvider } from "react-helmet-async";

const { useSession, listSessions, listAccounts, twoFactor } = vi.hoisted(() => ({
  useSession: vi.fn(() => ({
    data: { session: { id: "s1" }, user: { twoFactorEnabled: false } },
  })),
  listSessions: vi.fn(),
  listAccounts: vi.fn(),
  twoFactor: { enable: vi.fn(), disable: vi.fn(), generateBackupCodes: vi.fn() },
}));
vi.mock("@/lib/auth", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/auth")>();
  return { ...real, useSession, authClient: { listSessions, listAccounts, twoFactor } };
});
vi.mock("@/lib/native-auth", () => ({ verifySecondFactor: vi.fn() }));
vi.mock("@/functions/api", () => ({ setPassword: vi.fn() }));

import SecurityPage from "./security";
import { copy } from "@/components/dashboard/copy";
import { copy as authCopy } from "@/components/auth/copy";

const row = (id: string) => ({
  id,
  token: `t-${id}`,
  userAgent: "",
  ipAddress: null,
  updatedAt: new Date(0),
});
const credential = { providerId: "credential", updatedAt: new Date(0) };

function mount(accounts: unknown[] = []) {
  listAccounts.mockResolvedValue({ data: accounts, error: null });
  render(
    <HelmetProvider>
      <SecurityPage />
    </HelmetProvider>,
  );
}

// Account rows wait for `listAccounts`: until then they can't know if a password exists.
async function enabled(role: "button" | "switch", name: string | RegExp) {
  const el = await screen.findByRole(role, { name });
  await vi.waitFor(() => expect(el).toBeEnabled());
  return el;
}

describe("<SecurityPage>", () => {
  it("marks this device and offers no sign-out-others when it is the only session", async () => {
    listSessions.mockResolvedValue({ data: [row("s1")], error: null });
    mount();

    expect(await screen.findByText(copy.profile.thisDevice)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.profile.revokeDevice })).toBeNull();
    expect(screen.queryByText(copy.profile.revokeOthers)).toBeNull();
  });

  it("lets another device be revoked and offers sign-out-others", async () => {
    listSessions.mockResolvedValue({ data: [row("s1"), row("s2")], error: null });
    mount();

    expect(
      await screen.findByRole("button", { name: copy.profile.revokeDevice }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(copy.profile.thisDevice)).toHaveLength(1);
    expect(screen.getByText(copy.profile.revokeOthers)).toBeInTheDocument();
  });

  it("offers to create a password for a link-only account, with no current-password field", async () => {
    const user = userEvent.setup();
    listSessions.mockResolvedValue({ data: [row("s1")], error: null });
    mount();

    await user.click(await enabled("button", /Senha.*Criar senha/));
    expect(screen.getByLabelText(copy.profile.passwordNew)).toBeInTheDocument();
    expect(screen.queryByLabelText(copy.profile.passwordCurrent)).toBeNull();
  });

  it("turns MFA on without a password for a link-only account and opens the setup", async () => {
    const user = userEvent.setup();
    listSessions.mockResolvedValue({ data: [row("s1")], error: null });
    twoFactor.enable.mockResolvedValue({
      data: { totpURI: "otpauth://totp/Mewki:a?secret=JBSWY3DPEHPK3PXP", backupCodes: ["a-1"] },
      error: null,
    });
    mount();

    await user.click(await enabled("switch", copy.profile.mfaApp));
    expect(twoFactor.enable).toHaveBeenCalledWith({ password: "" });
    expect(await screen.findByText(authCopy.mfaSetup.step2)).toBeInTheDocument();
  });

  it("asks the password first when the account has one", async () => {
    const user = userEvent.setup();
    listSessions.mockResolvedValue({ data: [row("s1")], error: null });
    mount([credential]);

    await user.click(await enabled("switch", copy.profile.mfaApp));
    expect(twoFactor.enable).not.toHaveBeenCalled();
    expect(screen.getByText(authCopy.mfaSetup.password)).toBeInTheDocument();
  });
});
