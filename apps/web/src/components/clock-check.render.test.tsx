/** @vitest-environment jsdom */
import { useState } from "react";
import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ClockCheck, clockAngles } from "./clock-check";

const Harness = ({ time }: { time?: string }) => {
  const [checked, setChecked] = useState(false);
  return <ClockCheck checked={checked} onCheckedChange={setChecked} time={time} label="Concluir" />;
};

describe("clockAngles", () => {
  it("hora em 12h, minuto em 6°/min, 0° = 12h", () => {
    expect(clockAngles("21:00")).toEqual({ hour: 270, minute: 0 });
    expect(clockAngles("09:30")).toEqual({ hour: 285, minute: 180 });
    expect(clockAngles("12:00")).toEqual({ hour: 0, minute: 0 });
  });
});

describe("ClockCheck", () => {
  it("alterna aria-checked no clique", () => {
    render(<Harness />);
    const box = screen.getByRole("checkbox", { name: "Concluir" });
    expect(box.getAttribute("aria-checked")).toBe("false");
    fireEvent.click(box);
    expect(box.getAttribute("aria-checked")).toBe("true");
  });

  it("1 ponto sem horário, 2 com horário", () => {
    const { container, rerender } = render(<Harness />);
    expect(container.querySelectorAll("circle[data-dot]")).toHaveLength(1);
    rerender(<Harness time="09:30" />);
    expect(container.querySelectorAll("circle[data-dot]")).toHaveLength(2);
  });
});
