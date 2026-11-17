/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Task } from "@dailify/shared";

import { copy } from "./copy";

import { TaskForm } from "./task-form";

const task: Task = {
  id: "t",
  title: "Faxina",
  date: new Date(2026, 10, 16, 9).getTime(),
  duration: "1h",
  priority: 0,
  repeat: { Weekly: ["Monday"] },
  repeatEvery: 2,
  completed: [],
};

const setup = (initial: Task, view: "root" | "links" = "root") => {
  const onSubmit = vi.fn();
  render(<TaskForm id="f" task={initial} view={view} onView={vi.fn()} onSubmit={onSubmit} />);
  const submit = () => {
    const form = document.getElementById("f");
    if (form) fireEvent.submit(form);
    return onSubmit.mock.calls[0][0];
  };
  return { submit };
};

describe("<TaskForm> intervalo", () => {
  it("mostra o intervalo da série e grava o novo", () => {
    const { submit } = setup(task);
    const select = screen.getByRole("combobox", { name: copy.form.repeatEvery });
    expect(select).toHaveValue("2");
    expect(select).toHaveDisplayValue("A cada 2 semanas");

    fireEvent.change(select, { target: { value: "3" } });
    expect(submit()).toMatchObject({ repeat: { Weekly: ["Monday"] }, repeatEvery: 3 });
  });

  it("sem repetição não oferece intervalo, e o valor volta a 1", () => {
    const { submit } = setup(task);
    fireEvent.change(screen.getByRole("combobox", { name: copy.form.repeat }), {
      target: { value: "Off" },
    });
    expect(screen.queryByRole("combobox", { name: copy.form.repeatEvery })).toBeNull();
    expect(submit()).toMatchObject({ repeat: "Off", repeatEvery: 1 });
  });
});

describe("<TaskForm> raiz", () => {
  it("o subtítulo diz o dia e o intervalo pela duração", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(15, 0, 0, 0);
    setup({ ...task, date: tomorrow.getTime(), repeat: "Off" });
    expect(screen.getByText("Amanhã, 15:00 às 16:00")).toBeInTheDocument();
  });

  it("trocar o link não desvincula o evento do Google Agenda", () => {
    const event = "https://www.google.com/calendar/event?eid=abc";
    const { submit } = setup({ ...task, links: [event, "https://meet.google.com/x"] }, "links");
    const field = screen.getByRole("textbox", { name: copy.form.links });
    expect(field).toHaveValue("https://meet.google.com/x");
    fireEvent.change(field, { target: { value: "https://zoom.us/j/1" } });
    expect(submit()).toMatchObject({ links: ["https://zoom.us/j/1", event] });
  });
});
