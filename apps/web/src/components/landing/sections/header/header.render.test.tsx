/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { copy } from "./copy";
import { SiteHeaderV2 } from "./index";

describe("<SiteHeaderV2>", () => {
  it("tem menu rotulado e Entrar levando ao login", () => {
    render(
      <MemoryRouter>
        <SiteHeaderV2 />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: copy.menu })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: copy.signIn })).toHaveAttribute("href", "/login");
  });
});
