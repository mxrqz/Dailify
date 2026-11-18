/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Faq } from "./index";
import { copy } from "./copy";

describe("<Faq>", () => {
  it("abre uma pergunta por vez, a primeira já aberta", async () => {
    render(<Faq />);
    expect(screen.getByRole("heading", { name: copy.title })).toBeInTheDocument();
    const [first, second] = copy.items.map((it) => screen.getByRole("button", { name: it.q }));
    expect(first).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById(first.getAttribute("aria-controls") ?? "")).not.toBeNull();

    await userEvent.click(second);
    expect(second).toHaveAttribute("aria-expanded", "true");
    expect(first).toHaveAttribute("aria-expanded", "false");
  });
});
