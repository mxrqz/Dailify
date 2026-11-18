/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import AppReturn from "./app-return";
import { copy } from "@/components/auth/copy";

const renderAt = (url: string) =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/app/*" element={<AppReturn />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );

const browserLink = () => screen.getByRole("link", { name: copy.appReturn.browser });

describe("<AppReturn>", () => {
  it("hands the path and query to the app and to the browser link", () => {
    renderAt("/app/billing?checkout=success");
    expect(screen.getByRole("link", { name: copy.appReturn.open })).toHaveAttribute(
      "href",
      "mewki://open/billing?checkout=success",
    );
    expect(browserLink()).toHaveAttribute("href", "/billing?checkout=success");
  });

  it("keeps the query on a bare /app", () => {
    renderAt("/app?checkout=cancel");
    expect(browserLink()).toHaveAttribute("href", "/dashboard?checkout=cancel");
  });

  it.each(["/app//evil.com", "/app/\\evil.com"])("never links off-site from %s", (url) => {
    renderAt(url);
    expect(browserLink()).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: copy.appReturn.open })).toHaveAttribute(
      "href",
      "mewki://open/dashboard",
    );
  });
});
