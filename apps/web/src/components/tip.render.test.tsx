/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Tip } from "./tip";
import { TooltipProvider } from "@/components/ui/tooltip";

const renderTip = () =>
  render(
    <TooltipProvider delayDuration={0}>
      <Tip content="Voltar">
        <button type="button">ir</button>
      </Tip>
    </TooltipProvider>,
  );

describe("<Tip>", () => {
  /**
   * O contrato é o `asChild`: o gatilho tem que ser o próprio botão, senão o `aria-describedby`
   * pousa num elemento que o teclado não alcança e o tooltip vira decoração de mouse.
   */
  it("descreve o gatilho focável quando abre", async () => {
    renderTip();

    const trigger = screen.getByRole("button", { name: "ir" });
    expect(trigger).not.toHaveAttribute("aria-describedby");

    await userEvent.tab();

    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-describedby");
    expect(await screen.findAllByText("Voltar")).not.toHaveLength(0);
  });
});
