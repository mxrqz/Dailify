/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { World } from ".";
import { copy } from "./copy";

describe("<World>", () => {
  it("mostra o título e os oito apps", () => {
    render(<World />);
    expect(screen.getByRole("heading", { name: copy.title })).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(8);
  });
});
