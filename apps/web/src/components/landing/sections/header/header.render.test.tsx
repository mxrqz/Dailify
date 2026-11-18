/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { copy } from "./copy";
import { SiteHeader } from "./index";

describe("<SiteHeader>", () => {
  it("Entrar leva ao login", () => {
    render(
      <MemoryRouter>
        <SiteHeader />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: copy.signIn })).toHaveAttribute("href", "/login");
  });
});
