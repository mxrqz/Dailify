/** @vitest-environment jsdom */
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

vi.mock("@/lib/auth", () => ({
  authClient: { signIn: { magicLink: vi.fn(), social: vi.fn() } },
  useSession: () => ({ data: null }),
}));
const native = vi.hoisted(() => ({ signingIn: false }));
vi.mock("@/lib/native-auth", () => ({
  startNativeMagicLink: vi.fn(),
  isSigningIn: () => native.signingIn,
  onSigningIn: () => () => {},
}));
vi.mock("@/components/auth/turnstile", () => ({
  useTurnstile: () => ({ ref: { current: null }, token: () => Promise.resolve("") }),
}));

import Login from "@/pages/login";
import Signup from "@/pages/signup";
import { copy } from "./copy";

function Search() {
  return <p>search: {useLocation().search}</p>;
}

describe("<AuthPage> cross-link", () => {
  it("carries the typed e-mail between login and signup without putting it in the URL", async () => {
    const user = userEvent.setup();
    const from = { pathname: "/billing", search: "" };
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={[{ pathname: "/login", state: { from } }]}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/signup"
              element={
                <>
                  <Signup />
                  <Search />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>,
    );

    await user.type(screen.getByLabelText(copy.shell.emailLabel), "ana@x.com");
    await user.click(screen.getByRole("link", { name: copy.signIn.crossLinkAction }));

    expect(await screen.findByRole("heading", { name: copy.signUp.title })).toBeInTheDocument();
    expect(screen.getByLabelText(copy.shell.emailLabel)).toHaveValue("ana@x.com");
    expect(screen.getByText("search:")).toBeInTheDocument();

    await user.clear(screen.getByLabelText(copy.shell.emailLabel));
    await user.type(screen.getByLabelText(copy.shell.emailLabel), "bia@x.com");
    await user.click(screen.getByRole("link", { name: copy.signUp.crossLinkAction }));

    expect(await screen.findByLabelText(copy.shell.emailLabel)).toHaveValue("bia@x.com");
  });
});

describe("<AuthPage> app sign-in link", () => {
  afterEach(() => {
    native.signingIn = false;
  });

  it("shows the loading splash instead of the form while the e-mailed link is verified", () => {
    native.signingIn = true;
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={["/login"]}>
          <Login />
        </MemoryRouter>
      </HelmetProvider>,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByLabelText(copy.shell.emailLabel)).toBeNull();
  });
});
