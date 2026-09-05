/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { forwardRef, type ComponentPropsWithoutRef } from "react";

import { Tip } from "./tip";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

  /**
   * O arranjo do `task-card`: um gatilho de menu envolve, por `asChild`, um componente que espalha
   * as props recebidas no `<button>` — e o `Tip` fica no meio. Se alguém tirar o espalhamento e
   * colar o `Tip` direto no `asChild`, as props do menu param nele (que não repassa nada) e o
   * clique some sem erro nenhum.
   */
  it("deixa o clique do menu passar quando um asChild o envolve", async () => {
    const ToolbarButton = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<"button">>(
      function ToolbarButton(props, ref) {
        return (
          <Tip content="Prioridade" side="top">
            <button ref={ref} type="button" aria-label="prioridade" {...props} />
          </Tip>
        );
      },
    );

    render(
      <TooltipProvider delayDuration={0}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <ToolbarButton />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Alta</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TooltipProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "prioridade" }));

    expect(await screen.findByRole("menuitem", { name: "Alta" })).toBeInTheDocument();
  });
});
