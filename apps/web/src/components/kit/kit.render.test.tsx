/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ActionSheet } from "./action-sheet";

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
