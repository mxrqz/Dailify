/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { Cta } from "../cta";
import { Footer } from "./index";
import { copy } from "./copy";

describe("<Footer> e <Cta>", () => {
  it("renderizam", () => {
    render(
      <MemoryRouter>
        <Cta />
        <Footer />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: copy.legal.terms })).toHaveAttribute("href", "/termos");
    expect(screen.getByRole("button", { name: copy.theme.system })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("link", { name: "Começar grátis" })).toHaveAttribute("href", "/signup");
  });
});
