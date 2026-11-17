/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ActionSheet } from "./action-sheet";
import { Chip } from "./chip";
import { ListGroup, ListRow } from "./list";
import { SegmentedControl } from "./segmented-control";
import { Switch } from "./switch";

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
