/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { copy } from "./copy";
import { Features } from "./index";

describe("<Features>", () => {
  it("com reduced motion, cada card já mostra o estado final", () => {
    // o motion lê a preferência uma vez, no primeiro uso: precisa vir antes do render
    const mm = window.matchMedia;
    window.matchMedia = (q) => ({ ...mm(q), matches: q.includes("reduce") });
    render(<Features />);
    expect(screen.getByRole("heading", { name: copy.title })).toBeInTheDocument();
    for (const c of [copy.talk, copy.repeat, copy.remind, copy.ok])
      expect(screen.getByRole("heading", { name: c.title })).toBeInTheDocument();
    expect(screen.getByText(copy.talk.eventTitle)).toBeInTheDocument();
    expect(screen.getByText(copy.ok.scenarios[0].body)).toBeInTheDocument();
    window.matchMedia = mm;
  });
});
