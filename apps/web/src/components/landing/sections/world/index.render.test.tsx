/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { WorldV2 } from ".";
import { copy } from "./copy";

describe("<WorldV2>", () => {
  it("mostra o título e os oito apps", () => {
    render(<WorldV2 />);
    expect(screen.getByRole("heading", { name: copy.title })).toBeInTheDocument();
    expect(screen.getAllByRole("img")).toHaveLength(8);
  });
});
