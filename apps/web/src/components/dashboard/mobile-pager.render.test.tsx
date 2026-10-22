/** @vitest-environment jsdom */
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { MobilePager } from "./mobile-pager";
import { SwipeActions } from "./swipe-actions";

// jsdom não implementa `scrollTo`, e o pager rola a janela a cada troca de página.
const scrollTo = vi.fn();
beforeEach(() => {
  scrollTo.mockClear();
  window.scrollTo = scrollTo;
});

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

describe("<MobilePager> como telas", () => {
  it("a página de fora fica inert e presa à altura da tela", () => {
    render(<Harness />);
    const hidden = screen.getByText("lista").parentElement;
    expect(hidden?.inert).toBe(true);
    expect(hidden).toHaveClass("max-h-dvh");
    expect(screen.getByText("agenda").parentElement?.inert).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Sem data" }));
    expect(screen.getByText("agenda").parentElement?.inert).toBe(true);
    expect(screen.getByText("lista").parentElement).not.toHaveClass("max-h-dvh");
  });

  it("cada página guarda a própria rolagem; Sem data começa no topo", () => {
    render(<Harness />);
    expect(scrollTo).not.toHaveBeenCalled();

    window.scrollY = 500;
    fireEvent.click(screen.getByRole("button", { name: "Sem data" }));
    expect(scrollTo).toHaveBeenLastCalledWith(0, 0);

    window.scrollY = 40;
    fireEvent.click(screen.getByRole("button", { name: "Hoje" }));
    expect(scrollTo).toHaveBeenLastCalledWith(0, 500);

    fireEvent.click(screen.getByRole("button", { name: "Sem data" }));
    expect(scrollTo).toHaveBeenLastCalledWith(0, 40);
    window.scrollY = 0;
  });
});
