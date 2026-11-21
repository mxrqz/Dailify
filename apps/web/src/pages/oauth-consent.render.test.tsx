/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const { $fetch, session } = vi.hoisted(() => {
  const current: { data: object | null; isPending: boolean } = { data: null, isPending: false };
  return { $fetch: vi.fn(), session: { current } };
});
vi.mock("@/lib/auth", () => ({
  authClient: { $fetch },
  useSession: () => session.current,
  settle: <T,>(p: Promise<T>) => p,
}));

import OAuthConsent from "./oauth-consent";
import { copy } from "@/components/auth/copy";
import { fill } from "@/functions/functions";

const QUERY =
  "?client_id=c1&redirect_uri=https%3A%2F%2Fclaude.ai%2Fapi%2Fmcp%2Fauth_callback&sig=s";
const renderAt = (url: string) =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/oauth/consent" element={<OAuthConsent />} />
          <Route path="/login" element={<p>login page</p>} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );

describe("<OAuthConsent>", () => {
  beforeEach(() => {
    session.current = { data: { user: { id: "u1" } }, isPending: false };
    $fetch.mockImplementation(async (path: string) =>
      path === "/oauth2/public-client"
        ? { data: { client_id: "c1", client_name: "Claude" }, error: null }
        : {
            data: { redirect: true, url: "https://claude.ai/api/mcp/auth_callback?code=x" },
            error: null,
          },
    );
  });

  it("names the client and where it returns, then sends the browser to its redirect on Allow", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    renderAt(`/oauth/consent${QUERY}`);

    expect(
      await screen.findByRole("heading", { name: fill(copy.consent.title, { client: "Claude" }) }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(fill(copy.consent.returnsTo, { host: "claude.ai" })),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: copy.consent.allow }));
    expect($fetch).toHaveBeenCalledWith("/oauth2/consent", {
      method: "POST",
      body: { accept: true },
    });
    expect(assign).toHaveBeenCalledWith("https://claude.ai/api/mcp/auth_callback?code=x");
  });

  it("shows an error when the consent call fails", async () => {
    $fetch.mockResolvedValue({ data: null, error: { status: 400 } });
    renderAt(`/oauth/consent${QUERY}`);
    await userEvent.click(screen.getByRole("button", { name: copy.consent.deny }));
    expect(await screen.findByRole("alert")).toHaveTextContent(copy.consent.failed);
  });

  it("sends a signed-out visitor to the login page with the same query", () => {
    session.current = { data: null, isPending: false };
    renderAt(`/oauth/consent${QUERY}`);
    expect(screen.getByText("login page")).toBeInTheDocument();
  });
});
