/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { copy } from "./copy";
import { HeroV2 } from "./index";

describe("<HeroV2>", () => {
  it("mostra o título e o CTA para o cadastro", () => {
    render(
      <MemoryRouter>
        <HeroV2 />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 1, name: copy.title })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: copy.cta })).toHaveAttribute("href", "/signup");
  });
});
