/** @vitest-environment jsdom */
import { useState } from "react";
import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ClockCheck, hourAngle } from "./clock-check";

const Harness = ({ time }: { time?: string }) => {
  const [checked, setChecked] = useState(false);
  return <ClockCheck checked={checked} onCheckedChange={setChecked} time={time} label="Concluir" />;
};

describe("hourAngle", () => {
  it("relógio de 12h com a fração dos minutos, 0° = 12h", () => {
    expect(hourAngle("21:00")).toBe(270);
    expect(hourAngle("09:30")).toBe(285);
    expect(hourAngle("12:00")).toBe(0);
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

  it("um ponto: no centro sem horário, fora dele com horário", () => {
    const { container, rerender } = render(<Harness />);
    const dot = () => container.querySelectorAll("circle[data-dot]");
    expect(dot()).toHaveLength(1);
    expect(dot()[0].getAttribute("cy")).toBe("10");
    rerender(<Harness time="12:00" />);
    expect(dot()).toHaveLength(1);
    expect(dot()[0].getAttribute("cy")).toBe("5.5");
  });
});
