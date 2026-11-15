/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { CtaV2 } from "../cta";
import { FooterV2 } from "./index";
import { copy } from "./copy";

describe("<FooterV2> e <CtaV2>", () => {
  it("renderizam", () => {
    render(
      <MemoryRouter>
        <CtaV2 />
        <FooterV2 />
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
