/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

import { Sheet, SheetContent, SheetTitle, canDragSheet, shouldCloseSheet } from "./sheet";
import { copy } from "@/components/dashboard/copy";

describe("canDragSheet", () => {
  const panel = document.createElement("div");
  panel.innerHTML = `
    <p id="text">Dentista</p>
    <input id="input" /><textarea id="area"></textarea>
    <div contenteditable="true"><b id="rich">x</b></div>
    <div role="slider" id="slider"></div>
    <div id="list"><button id="row">Dia</button></div>`;
  document.body.append(panel);
  const el = (id: string) => document.getElementById(id);

  it("começa em qualquer ponto do painel, menos num campo", () => {
    expect(canDragSheet(el("text"), panel)).toBe(true);
    expect(canDragSheet(el("row"), panel)).toBe(true);
    for (const id of ["input", "area", "rich", "slider"])
      expect(canDragSheet(el(id), panel)).toBe(false);
  });

  it("numa lista rolada o dedo é da rolagem; no topo dela, da folha", () => {
    const list = el("list");
    if (!list) throw new Error("sem lista");
    Object.defineProperty(list, "scrollTop", { value: 40, configurable: true });
    expect(canDragSheet(el("row"), panel)).toBe(false);
    Object.defineProperty(list, "scrollTop", { value: 0, configurable: true });
    expect(canDragSheet(el("row"), panel)).toBe(true);
  });

  // O evento de um diálogo aberto de dentro da folha chega pelo React, mas o alvo mora no portal.
  it("ignora alvo fora do painel", () => {
    expect(canDragSheet(document.body, panel)).toBe(false);
    expect(canDragSheet(null, panel)).toBe(false);
  });
});

describe("shouldCloseSheet", () => {
  it("fecha passado um quarto da altura", () => {
    expect(shouldCloseSheet(101, 0, 400)).toBe(true);
    expect(shouldCloseSheet(99, 0, 400)).toBe(false);
  });

  it("fecha num empurrão pra baixo, nunca num pra cima", () => {
    expect(shouldCloseSheet(20, 600, 400)).toBe(true);
    expect(shouldCloseSheet(20, 400, 400)).toBe(false);
    expect(shouldCloseSheet(-4, 600, 400)).toBe(false);
  });
});

function Controlled() {
  const [open, setOpen] = useState(true);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="bottom" aria-describedby={undefined}>
        <SheetTitle>Dentista</SheetTitle>
      </SheetContent>
    </Sheet>
  );
}

describe("<SheetContent side='bottom'>", () => {
  it("o arrasto não tira o Esc", async () => {
    render(<Controlled />);
    expect(screen.getByRole("dialog", { name: "Dentista" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("nem o X (o fechar escondido do arrasto não aparece pra ninguém)", async () => {
    render(<Controlled />);
    const closes = screen.getAllByRole("button");
    expect(closes).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: copy.kit.close }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
