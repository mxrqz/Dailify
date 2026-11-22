/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ActionSheet } from "./action-sheet";
import { Chip } from "./chip";
import { copy as kitCopy } from "./copy";
import { ListGroup, ListRow } from "./list";
import { OtpInput } from "./otp-input";
import { Refraction } from "./refraction";
import { SegmentedControl } from "./segmented-control";
import { Switch } from "./switch";
import { CheckCircle, TaskRow } from "./task-row";
import { copy } from "@/components/dashboard/copy";

describe("ActionSheet", () => {
  it("é um alertdialog; escolher roda a ação e fecha, Cancelar só fecha", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const only = vi.fn();
    render(
      <ActionSheet
        open
        onOpenChange={onOpenChange}
        title="Esta tarefa se repete"
        description="O que você quer alterar?"
        actions={[
          { label: "Só esta ocorrência", onSelect: only, primary: true },
          { label: "Todas as ocorrências", onSelect: vi.fn() },
        ]}
      />,
    );

    const sheet = screen.getByRole("alertdialog", { name: "Esta tarefa se repete" });
    expect(sheet).toHaveAccessibleDescription("O que você quer alterar?");

    await user.click(screen.getByRole("button", { name: "Só esta ocorrência" }));
    expect(only).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);

    onOpenChange.mockClear();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });
});

describe("controles", () => {
  it("SegmentedControl é um radiogroup e não emite ao clicar no escolhido", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <SegmentedControl
        aria-label="Tema"
        value="dark"
        onValueChange={onValueChange}
        options={[
          { value: "light", label: "Claro" },
          { value: "dark", label: "Escuro" },
        ]}
      />,
    );

    expect(screen.getByRole("radiogroup", { name: "Tema" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Escuro" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Escuro" }));
    expect(onValueChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole("radio", { name: "Claro" }));
    expect(onValueChange).toHaveBeenCalledWith("light");
  });

  it("Switch é role=switch e pede o inverso do estado", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="Lembretes" checked={false} onCheckedChange={onCheckedChange} />);

    const toggle = screen.getByRole("switch", { name: "Lembretes" });
    expect(toggle).not.toBeChecked();
    await user.click(toggle);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("Chip com onRemove tem dois botões: o principal e o ×", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <Chip onRemove={onRemove} pressed>
        15:00
      </Chip>,
    );

    expect(screen.getByRole("button", { name: "15:00" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Remover" }));
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("ListRow vira link com href, botão com onClick e div sem nenhum", () => {
    render(
      <ListGroup title="Integrações">
        <ListRow label="Google Agenda" href="https://calendar.google.com" accessory="external" />
        <ListRow label="Sair" onClick={() => {}} />
        <ListRow label="Versão" value="1.0" />
      </ListGroup>,
    );

    expect(screen.getByRole("region", { name: "Integrações" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Google Agenda" })).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("button", { name: "Sair" })).toHaveAttribute("type", "button");
    expect(screen.getByText("Versão").closest("a, button")).toBeNull();
  });
});

describe("TaskRow", () => {
  it("shows the now badge while live and strikes the title once done", () => {
    const { rerender } = render(<TaskRow time="10:00" title="Proposta" live />);
    expect(screen.getByText(copy.day.now)).toBeInTheDocument();
    rerender(<TaskRow time="10:00" title="Proposta" done />);
    expect(screen.queryByText(copy.day.now)).toBeNull();
    // The drawn strike, with the plain line-through kept for reduced motion.
    expect(screen.getByText("Proposta")).toHaveClass(
      "after:scale-x-100",
      "motion-reduce:line-through",
    );
  });

  it("CheckCircle is a checkbox that asks for the opposite state", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    render(<CheckCircle checked={false} onCheckedChange={onCheckedChange} />);
    await user.click(screen.getByRole("checkbox", { name: copy.task.complete }));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
    // Unchecked, the check is fully undrawn (dash offset = its whole pathLength).
    expect(document.querySelector("path")).toHaveAttribute("stroke-dashoffset", "1");
  });
});

describe("Refraction", () => {
  it("só marca o <html> no Chromium; o <filter> monta sempre", () => {
    const html = document.documentElement;
    const { unmount } = render(<Refraction />);
    expect(document.getElementById("refract")).not.toBeNull();
    expect(html).not.toHaveClass("refract");
    unmount();

    vi.stubGlobal("navigator", { userAgentData: { brands: [{ brand: "Chromium" }] } });
    const chromium = render(<Refraction />);
    expect(html).toHaveClass("refract");
    chromium.unmount();
    expect(html).not.toHaveClass("refract");
    vi.unstubAllGlobals();
  });
});

describe("OtpInput", () => {
  it("keeps digits only, fills on paste, completes once on the 6th digit and clears on error", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const { rerender } = render(<OtpInput onComplete={onComplete} />);
    const field = screen.getByRole("textbox", { name: kitCopy.code });
    expect(field).toHaveAttribute("autocomplete", "one-time-code");

    await user.type(field, "4a8-2");
    expect(field).toHaveValue("482");
    expect(onComplete).not.toHaveBeenCalled();

    await user.clear(field);
    await user.click(field);
    await user.paste("482 913 77");
    expect(field).toHaveValue("482913");
    expect(onComplete).toHaveBeenCalledExactlyOnceWith("482913");

    field.blur();
    rerender(<OtpInput onComplete={onComplete} error />);
    expect(field).toHaveValue("");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveFocus();
  });
});
