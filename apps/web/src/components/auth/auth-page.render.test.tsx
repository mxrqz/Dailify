/** @vitest-environment jsdom */
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const client = vi.hoisted(() => ({
  signIn: { magicLink: vi.fn(), social: vi.fn(), email: vi.fn() },
  signUp: { email: vi.fn() },
}));
vi.mock("@/lib/auth", () => ({ authClient: client, useSession: () => ({ data: null }) }));
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

describe("<AuthPage> password", () => {
  function mountAt(path: string) {
    render(
      <HelmetProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/two-factor" element={<Search />} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>,
    );
  }
  async function fill(user: ReturnType<typeof userEvent.setup>, submit: string) {
    await user.type(screen.getByLabelText(copy.shell.emailLabel), "ana@x.com");
    await user.type(screen.getByLabelText(copy.shell.passwordLabel), "correct horse battery");
    await user.click(screen.getByRole("button", { name: submit }));
  }

  it("signs in with e-mail and password and opens the second factor when it is due", async () => {
    const user = userEvent.setup();
    client.signIn.email.mockResolvedValue({ data: { twoFactorRedirect: true }, error: null });
    mountAt("/login");

    expect(screen.getByRole("link", { name: copy.shell.forgotPassword })).toHaveAttribute(
      "href",
      "/reset-password",
    );
    await fill(user, copy.signIn.passwordSubmit);

    expect(client.signIn.email).toHaveBeenCalledWith(
      expect.objectContaining({ email: "ana@x.com", password: "correct horse battery" }),
    );
    expect(await screen.findByText("search: ?next=%2Fdashboard")).toBeInTheDocument();
  });

  it("shows a wrong password without saying which half was wrong", async () => {
    const user = userEvent.setup();
    client.signIn.email.mockResolvedValue({
      data: null,
      error: { status: 401, code: "INVALID_EMAIL_OR_PASSWORD" },
    });
    mountAt("/login");
    await fill(user, copy.signIn.passwordSubmit);

    expect(await screen.findByText(copy.errors.wrongPassword)).toBeInTheDocument();
    expect(screen.getByLabelText(copy.shell.passwordLabel)).toHaveAttribute("aria-invalid", "true");
  });

  it("signs up into the confirm-your-e-mail screen, with no session", async () => {
    const user = userEvent.setup();
    client.signUp.email.mockResolvedValue({ data: { token: null }, error: null });
    mountAt("/signup");
    await fill(user, copy.signUp.passwordSubmit);

    expect(await screen.findByText(copy.verifySent.title)).toBeInTheDocument();
    expect(screen.getByText("ana@x.com")).toBeInTheDocument();
  });

  it("keeps the magic link one tap away", async () => {
    const user = userEvent.setup();
    mountAt("/login");
    await user.click(screen.getByRole("button", { name: copy.shell.emailLink }));

    expect(screen.queryByLabelText(copy.shell.passwordLabel)).toBeNull();
    expect(screen.getByRole("button", { name: copy.signIn.submit })).toBeInTheDocument();
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
