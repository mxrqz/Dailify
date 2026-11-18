/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Button } from "./button";

describe("<Button loading>", () => {
  it("keeps its label as the accessible name while busy and disables itself", () => {
    render(<Button loading>Salvar</Button>);
    const button = screen.getByRole("button", { name: "Salvar" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("renders a normal enabled button when not loading", () => {
    render(<Button>Salvar</Button>);
    const button = screen.getByRole("button", { name: "Salvar" });
    expect(button).toBeEnabled();
    expect(button).not.toHaveAttribute("aria-busy");
  });
});
