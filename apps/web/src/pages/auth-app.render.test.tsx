/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter } from "react-router-dom";

const { verify } = vi.hoisted(() => ({ verify: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authClient: { magicLink: { verify } } }));

import AuthApp from "./auth-app";
import { copy } from "@/components/auth/copy";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";

beforeEach(() => vi.restoreAllMocks());

const renderAt = (url: string) =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[url]}>
        <AuthApp />
      </MemoryRouter>
    </HelmetProvider>,
  );

describe("<AuthApp>", () => {
  it("desktop: oferece o esquema mewki:// e o navegador, sem nunca chamar verify", () => {
    renderAt("/auth/app?token=abc");
    expect(screen.getByRole("link", { name: copy.app.open })).toHaveAttribute(
      "href",
      "mewki://auth?token=abc",
    );
    expect(screen.getByRole("link", { name: copy.app.browser })).toHaveAttribute("href", "/login");
    expect(verify).not.toHaveBeenCalled();
  });

  it("celular sem o app: só o texto e o navegador", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(IPHONE);
    renderAt("/auth/app?token=abc");
    expect(screen.getByText(copy.app.mobile)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: copy.app.open })).toBeNull();
    expect(screen.getByRole("link", { name: copy.app.browser })).toBeInTheDocument();
    expect(verify).not.toHaveBeenCalled();
  });
});
