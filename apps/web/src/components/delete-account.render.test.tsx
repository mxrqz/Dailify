/** @vitest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  deleteUser: vi.fn(),
  signOutAndReload: vi.fn(),
  clearLocal: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authClient: { deleteUser: m.deleteUser },
  useSession: () => ({ data: { user: { id: "u1", email: "Ana@Mail.com" } } }),
}));
vi.mock("@/lib/native-auth", () => ({ signOutAndReload: m.signOutAndReload }));
vi.mock("@/functions/offline", () => ({ clearLocal: m.clearLocal }));
vi.mock("sonner", () => ({ toast: { error: m.toastError } }));

import { copy } from "@/components/dashboard/copy";
import { DeleteAccount } from "./delete-account";

const t = copy.profile;

async function openDialog() {
  render(<DeleteAccount />);
  await userEvent.click(screen.getByRole("button", { name: t.deleteAccount }));
  return {
    input: await screen.findByRole("textbox"),
    confirm: screen.getByRole("button", { name: t.deleteConfirmCta }),
  };
}

async function confirmWith(error: unknown) {
  m.deleteUser.mockResolvedValue({ error });
  const { input, confirm } = await openDialog();
  await userEvent.type(input, "ana@mail.com");
  await userEvent.click(confirm);
}

describe("<DeleteAccount>", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps Confirm disabled until the typed e-mail matches, case-insensitive and trimmed", async () => {
    const { input, confirm } = await openDialog();
    expect(confirm).toBeDisabled();
    await userEvent.type(input, " ana@mail.co");
    expect(confirm).toBeDisabled();
    await userEvent.type(input, "m ");
    expect(confirm).toBeEnabled();
  });

  it("clears local data and reloads signed out on success", async () => {
    await confirmWith(null);
    await waitFor(() => expect(m.signOutAndReload).toHaveBeenCalledWith());
    expect(m.clearLocal).toHaveBeenCalledWith("u1");
  });

  it("signs out to /login on an expired session, without clearing local data", async () => {
    await confirmWith({ code: "SESSION_EXPIRED" });
    await waitFor(() =>
      expect(m.signOutAndReload).toHaveBeenCalledWith("/login?error=SESSION_EXPIRED"),
    );
    expect(m.clearLocal).not.toHaveBeenCalled();
  });

  it("toasts any other error and keeps the user signed in", async () => {
    await confirmWith({ code: "OTHER" });
    await waitFor(() => expect(m.toastError).toHaveBeenCalledWith(t.deleteAccountError));
    expect(m.signOutAndReload).not.toHaveBeenCalled();
    expect(m.clearLocal).not.toHaveBeenCalled();
  });
});
