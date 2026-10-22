/** @vitest-environment jsdom */
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { MobilePager } from "./mobile-pager";
import { SwipeActions } from "./swipe-actions";

function Harness(): JSX.Element {
  const [index, setIndex] = useState<0 | 1>(0);
  return (
    <MobilePager
      pages={[<p key="a">agenda</p>, <p key="b">lista</p>]}
      index={index}
      onIndexChange={setIndex}
    />
  );
}

describe("<MobilePager>", () => {
  it("indicador com as duas páginas, a ativa marcada; tocar troca", () => {
    render(<Harness />);

    const today = screen.getByRole("button", { name: "Hoje" });
    const undated = screen.getByRole("button", { name: "Sem data" });
    expect(today).toHaveAttribute("aria-current", "true");
    expect(undated).not.toHaveAttribute("aria-current");

    fireEvent.click(undated);

    expect(undated).toHaveAttribute("aria-current", "true");
    expect(today).not.toHaveAttribute("aria-current");
  });

  it("setas do teclado trocam de página", () => {
    render(<Harness />);
    const today = screen.getByRole("button", { name: "Hoje" });
    const undated = screen.getByRole("button", { name: "Sem data" });

    fireEvent.keyDown(today, { key: "ArrowRight" });
    expect(undated).toHaveAttribute("aria-current", "true");

    fireEvent.keyDown(undated, { key: "ArrowLeft" });
    expect(today).toHaveAttribute("aria-current", "true");
  });

  it("a página fora da tela sai da árvore de acessibilidade", () => {
    render(<Harness />);
    expect(screen.getByText("lista").parentElement).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("agenda").parentElement).not.toHaveAttribute("aria-hidden");
  });
});

describe("<MobilePager> arrasto", () => {
  // Um arrasto horizontal de verdade pelo PanSession do framer (pointer events + frames).
  async function swipeLeft(target: Element) {
    const at = (clientX: number) => ({ clientX, clientY: 10, isPrimary: true, button: 0 });
    fireEvent.pointerDown(target, at(200));
    for (const clientX of [190, 170, 140, 100, 60]) {
      fireEvent.pointerMove(window, at(clientX));
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    fireEvent.pointerUp(window, at(60));
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  function DragHarness(): JSX.Element {
    const [index, setIndex] = useState<0 | 1>(0);
    return (
      <MobilePager
        pages={[
          <div key="a">
            <p>fundo</p>
            <SwipeActions onComplete={() => {}} onDelete={() => {}}>
              <p>cartão</p>
            </SwipeActions>
          </div>,
          <p key="b">lista</p>,
        ]}
        index={index}
        onIndexChange={setIndex}
      />
    );
  }

  it("arrastar fora de um cartão troca de página", async () => {
    render(<DragHarness />);
    await swipeLeft(screen.getByText("fundo"));
    expect(screen.getByRole("button", { name: "Sem data" })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it("arrastar um cartão não move o pager", async () => {
    render(<DragHarness />);
    await swipeLeft(screen.getByText("cartão"));
    expect(screen.getByRole("button", { name: "Hoje" })).toHaveAttribute("aria-current", "true");
  });
});
