/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { Task } from "@dailify/shared";

import { TooltipProvider } from "@/components/ui/tooltip";

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
  render(<TaskForm id="f" task={initial} view={view} onView={vi.fn()} onSubmit={onSubmit} />, {
    wrapper: TooltipProvider,
  });
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

describe("<TaskForm> dias da semana", () => {
  it("keeps the last day pressed, so a weekly series never saves empty", () => {
    const { submit } = setup(task);
    const day = (name: string) => screen.getByRole("button", { name });
    const [, mon, tue] = copy.form.repeatDays;

    fireEvent.click(day(mon));
    expect(day(mon)).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(day(tue));
    fireEvent.click(day(mon));
    expect(day(mon)).toHaveAttribute("aria-pressed", "false");
    expect(submit()).toMatchObject({ repeat: { Weekly: ["Tuesday"] } });
  });
});

describe("<TaskForm> tags", () => {
  it("names the removal in each tag's label, and tapping removes it", () => {
    const onSubmit = vi.fn();
    render(
      <TaskForm
        id="f"
        task={{ ...task, tags: ["casa"] }}
        view="tags"
        onView={vi.fn()}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Tirar a tag casa" }));
    expect(screen.queryByRole("button", { name: "Tirar a tag casa" })).toBeNull();
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

describe("<TaskForm> convite (readonly)", () => {
  it("trava título, data, hora, duração e repetição; prioridade segue editável", () => {
    render(<TaskForm id="f" task={task} view="root" onView={vi.fn()} onSubmit={vi.fn()} locked />);
    expect(screen.getByText(copy.calendar.readonly)).toBeInTheDocument();
    for (const name of [copy.form.date, copy.form.time, copy.form.duration, copy.form.repeat])
      expect(screen.getByLabelText(name)).toBeDisabled();
    expect(screen.getByRole("button", { name: task.title })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: copy.form.priority })).toBeEnabled();
  });
});

describe("<TaskForm> Meet da Agenda", () => {
  const event = "https://www.google.com/calendar/event?eid=abc";
  const meet = "https://meet.google.com/abc-defg-hij";
  const linked: Task = { ...task, links: [meet, event] };
  const mount = (
    onNewMeet?: () => Promise<string[] | undefined>,
    view: "root" | "meet" = "meet",
  ) => {
    const onSubmit = vi.fn();
    const onView = vi.fn();
    render(
      <TaskForm
        id="f"
        task={linked}
        view={view}
        onView={onView}
        onSubmit={onSubmit}
        onNewMeet={onNewMeet}
      />,
      { wrapper: TooltipProvider },
    );
    const submit = () => {
      const form = document.getElementById("f");
      if (form) fireEvent.submit(form);
      return onSubmit.mock.calls[0][0];
    };
    return { submit, onView };
  };

  it("a linha do Meet abre o editor só com a Agenda; sem ela, o campo de link", () => {
    const withCalendar = mount(vi.fn(), "root");
    fireEvent.click(screen.getByRole("button", { name: copy.form.links }));
    expect(withCalendar.onView).toHaveBeenLastCalledWith("meet");
    cleanup();
    const without = mount(undefined, "root");
    fireEvent.click(screen.getByRole("button", { name: copy.form.links }));
    expect(without.onView).toHaveBeenLastCalledWith("links");
  });

  it("colar outro Meet troca só a sala; link que não é sala não sobe", () => {
    const { submit } = mount(vi.fn());
    const field = screen.getByRole("textbox", { name: copy.form.meet });
    expect(field).toHaveValue(meet);
    fireEvent.change(field, { target: { value: "https://zoom.us/j/1" } });
    expect(field).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(field, { target: { value: "meet.google.com/xyz-wxyz-xyz" } });
    expect(submit()).toMatchObject({ links: ["https://meet.google.com/xyz-wxyz-xyz", event] });
  });

  it("remover tira o Meet e mantém o evento", () => {
    const { submit, onView } = mount(vi.fn());
    fireEvent.click(screen.getByRole("button", { name: copy.form.meetRemove }));
    expect(onView).toHaveBeenLastCalledWith("root");
    expect(submit()).toMatchObject({ links: [event] });
  });

  it("gerar novo Meet usa os links que o servidor devolveu", async () => {
    const fresh = "https://meet.google.com/new-meet-abc";
    const onNewMeet = vi.fn(async () => [event, fresh]);
    const { submit, onView } = mount(onNewMeet);
    fireEvent.click(screen.getByRole("button", { name: copy.form.meetNew }));
    await waitFor(() => expect(onView).toHaveBeenLastCalledWith("root"));
    expect(onNewMeet).toHaveBeenCalledOnce();
    expect(submit()).toMatchObject({ links: [event, fresh] });
  });
});
