/** @vitest-environment jsdom */
import { StrictMode } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const { verify, notify } = vi.hoisted(() => ({ verify: vi.fn(), notify: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  authClient: { magicLink: { verify }, $store: { notify } },
}));

import Verify from "./verify";
import { copy } from "@/components/auth/copy";
const renderAt = (hash: string) => {
  window.history.replaceState(null, "", `/verify${hash}`);
  return render(
    <StrictMode>
      <HelmetProvider>
        <MemoryRouter initialEntries={["/verify"]}>
          <Routes>
            <Route path="/verify" element={<Verify />} />
            <Route path="/dashboard" element={<p>dashboard</p>} />
            <Route path="/login" element={<p>login</p>} />
            <Route path="/billing" element={<p>billing</p>} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>
    </StrictMode>,
  );
};

describe("<Verify>", () => {
  it("sem clique não gasta o token (scanner de e-mail), e limpa o hash", () => {
    renderAt("#token=abc");
    expect(screen.getByRole("button", { name: copy.verify.submit })).toBeInTheDocument();
    expect(verify).not.toHaveBeenCalled();
    expect(window.location.hash).toBe("");
  });

  it("clique em Entrar verifica o token do hash e vai pro /dashboard", async () => {
    verify.mockResolvedValue({ data: {}, error: null });
    renderAt("#token=abc");
    await userEvent.click(screen.getByRole("button", { name: copy.verify.submit }));

    expect(await screen.findByText("dashboard")).toBeInTheDocument();
    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledWith(expect.objectContaining({ query: { token: "abc" } }));
    expect(notify).toHaveBeenCalledWith("$sessionSignal");
  });

  it("vai pro `next` interno; `next` de fora do site cai no /dashboard", async () => {
    verify.mockResolvedValue({ data: {}, error: null });
    const first = renderAt("#token=abc&next=%2Fbilling");
    await userEvent.click(screen.getByRole("button", { name: copy.verify.submit }));
    expect(await screen.findByText("billing")).toBeInTheDocument();
    first.unmount();

    renderAt("#token=abc&next=%2F%2Fevil.com");
    await userEvent.click(screen.getByRole("button", { name: copy.verify.submit }));
    expect(await screen.findByText("dashboard")).toBeInTheDocument();
  });

  it("token vencido/usado vira 'pedir novo link'", async () => {
    verify.mockResolvedValue({ data: null, error: { status: 0 } });
    renderAt("#token=abc");
    await userEvent.click(screen.getByRole("button", { name: copy.verify.submit }));

    expect(await screen.findByText(copy.verify.invalid)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: copy.verify.restart })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("sem token no hash já mostra 'pedir novo link'", () => {
    renderAt("");
    expect(screen.getByText(copy.verify.invalid)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.verify.submit })).toBeNull();
  });
});
