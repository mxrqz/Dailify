/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { copy } from "./copy";
import { Hero } from "./index";

describe("<Hero>", () => {
  it("mostra o título e o CTA para o cadastro", () => {
    render(
      <MemoryRouter>
        <Hero />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 1, name: copy.title })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: copy.cta })).toHaveAttribute("href", "/signup");
  });
});
