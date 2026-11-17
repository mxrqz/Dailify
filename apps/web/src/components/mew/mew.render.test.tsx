/** @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { copy } from "@/components/dashboard/copy";

import { Mew } from "./mew";
import { MewStatic } from "./mew-static";

const parts = (root: Element, k: string) =>
  Array.from(root.querySelectorAll(`[data-mew="${k}"]`)).map((e) => e.getAttribute("opacity"));

describe("MewStatic", () => {
  it("sleepy fecha os olhos no arco; happy esconde a pupila; idle fica de olho aberto", () => {
    const { container: sleepy } = render(<MewStatic mood="sleepy" />);
    expect(parts(sleepy, "shut")).toEqual(["1.000", "1.000"]);
    expect(parts(sleepy, "lid")).toEqual(["0.000", "0.000"]);

    const { container: happy } = render(<MewStatic happy />);
    expect(parts(happy, "pupil")).toEqual(["0.000", "0.000"]);

    const { container: idle } = render(<MewStatic />);
    expect(parts(idle, "pupil")).toEqual(["1.000", "1.000"]);
    expect(parts(idle, "shut")).toEqual(["0.000", "0.000"]);
    expect(idle.querySelector("[data-mood]")).toHaveAttribute("data-mood", "idle");
  });

  it("cada instância recorta com os próprios clipPaths", () => {
    const { container } = render(
      <>
        <MewStatic />
        <MewStatic />
      </>,
    );
    const ids = Array.from(container.querySelectorAll("clipPath")).map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const g of container.querySelectorAll("[clip-path]")) {
      const ref = g.getAttribute("clip-path")?.slice(5, -1);
      expect(g.closest("svg")?.querySelector(`clipPath[id="${ref}"]`)).not.toBeNull();
    }
  });
});

describe("Mew", () => {
  it("sem `onPet` é decorativa; com `onPet` vira botão de carinho", () => {
    const { container, unmount } = render(<Mew mood="thinking" />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.querySelector("[data-mood]")).toHaveAttribute("aria-hidden", "true");
    unmount();

    const onPet = vi.fn();
    render(<Mew onPet={onPet} />);
    fireEvent.click(screen.getByRole("button", { name: copy.mew.pet }));
    expect(onPet).toHaveBeenCalledOnce();
  });
});
