/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { copy } from "./copy";
import { UndatedColumn, useUndatedOpen } from "./undated-column";

function Harness(): JSX.Element {
  const [open, setOpen] = useUndatedOpen();
  return <UndatedColumn open={open} onOpenChange={setOpen} />;
}

afterEach(() => localStorage.clear());

describe("<UndatedColumn>", () => {
  it("fechada mostra só o puxador, sem contagem; clicar abre e lembra", () => {
    render(<Harness />);

    const handle = screen.getByRole("button", { name: copy.column.open });
    expect(handle).toHaveAttribute("aria-expanded", "false");
    expect(handle).toHaveTextContent("");

    fireEvent.click(handle);

    expect(handle).toHaveAttribute("aria-expanded", "true");
    expect(handle).toHaveAccessibleName(copy.column.close);
    expect(localStorage.getItem("dailify:undated-open")).toBe("1");
  });

  it("abre já aberta se o device lembrou", () => {
    localStorage.setItem("dailify:undated-open", "1");
    render(<Harness />);

    expect(screen.getByRole("button", { name: copy.column.close })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });
});
