/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const env = vi.hoisted(() => ({ mobile: true }));

// The shell's widgets have their own tests; here only which top bar shows matters.
vi.mock("@/components/app-header", async () => {
  const { copy } = await import("./dashboard/copy");
  return { AppHeader: () => <button>{copy.header.openNav}</button> };
});
vi.mock("@/components/nav", () => ({ Sidebar: () => null }));
vi.mock("@/components/duplicates-sheet", () => ({ Duplicates: () => null }));
vi.mock("@/components/credits-tray", () => ({ CreditsTray: () => null }));

import { AppLayout } from "./app-layout";
import { copy } from "./dashboard/copy";

const setup = (entries: string[]) => {
  render(
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<p>Hoje</p>} />
          <Route path="/settings" element={<p>settings page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
  return userEvent.setup();
};

beforeEach(() => {
  env.mobile = true;
  vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
    matches: env.mobile && query.includes("max-width"),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
});

describe("<AppLayout> account pages", () => {
  it("shows the back bar with the title and no menu on mobile, and back returns", async () => {
    const user = setup(["/dashboard", "/settings"]);

    expect(screen.getByText(copy.profile.settingsPageTitle)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.header.openNav })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: copy.legal.back }));
    expect(screen.getByText("Hoje")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: copy.header.openNav })).toBeInTheDocument();
  });

  it("falls back to Hoje when the page is the first entry", async () => {
    const user = setup(["/settings"]);

    await user.click(screen.getByRole("button", { name: copy.legal.back }));
    expect(screen.getByText("Hoje")).toBeInTheDocument();
  });

  it("keeps the app header on desktop", () => {
    env.mobile = false;
    setup(["/settings"]);

    expect(screen.getByRole("button", { name: copy.header.openNav })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: copy.legal.back })).not.toBeInTheDocument();
  });
});
