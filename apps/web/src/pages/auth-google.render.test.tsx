/** @vitest-environment jsdom */
import { StrictMode } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";

const auth = vi.hoisted(() => ({
  useSession: vi.fn(),
  authClient: { signIn: { social: vi.fn() }, $fetch: vi.fn() },
}));
vi.mock("@/lib/auth", () => auth);

import AuthGoogle from "./auth-google";
import { copy } from "@/components/auth/copy";

const CHALLENGE = "c".repeat(43);
const renderAt = (url: string) =>
  render(
    <StrictMode>
      <HelmetProvider>
        <MemoryRouter initialEntries={[url]}>
          <AuthGoogle />
        </MemoryRouter>
      </HelmetProvider>
    </StrictMode>,
  );

describe("<AuthGoogle>", () => {
  it("signed out: starts Google once, coming back to the same page", () => {
    auth.useSession.mockReturnValue({ data: null, isPending: false });
    auth.authClient.signIn.social.mockResolvedValue({ error: null });
    renderAt(`/auth/google?challenge=${CHALLENGE}`);
    expect(auth.authClient.signIn.social).toHaveBeenCalledTimes(1);
    expect(auth.authClient.signIn.social).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "google", callbackURL: window.location.href }),
    );
    expect(auth.authClient.$fetch).not.toHaveBeenCalled();
  });

  it("signed in: mints one token for the challenge and offers it to the app", async () => {
    auth.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    auth.authClient.$fetch.mockResolvedValue({ data: { token: "ott123" } });
    renderAt(`/auth/google?challenge=${CHALLENGE}`);
    expect(await screen.findByRole("link", { name: copy.app.open })).toHaveAttribute(
      "href",
      "mewki://auth?ott=ott123",
    );
    expect(auth.authClient.$fetch).toHaveBeenCalledTimes(1);
    expect(auth.authClient.$fetch).toHaveBeenCalledWith("/one-time-token/generate", {
      method: "GET",
      query: { challenge: CHALLENGE },
    });
  });

  it("without a valid challenge does nothing and says the link is invalid", () => {
    auth.useSession.mockReturnValue({ data: { user: { id: "u1" } }, isPending: false });
    renderAt("/auth/google?challenge=short");
    expect(screen.getByText(copy.verify.invalid)).toBeInTheDocument();
    expect(auth.authClient.$fetch).not.toHaveBeenCalled();
    expect(auth.authClient.signIn.social).not.toHaveBeenCalled();
  });
});
