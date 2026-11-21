/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { copy } from "./copy";
import { MEW_PANEL_SLOT, PanelHost } from "./side-panel";
import { setAppTimeZone, zonedAt } from "@/functions/zone";
import { closePanel, openPanel, togglePanel } from "@/hooks/usePanel";

beforeEach(() => closePanel());
afterEach(() => setAppTimeZone(null));

const panel = () => screen.queryByRole("complementary");

describe("<PanelHost>", () => {
  it("renders nothing while closed", () => {
    render(<PanelHost />);
    expect(panel()).toBeNull();
  });

  it("titles each kind", () => {
    setAppTimeZone("America/Sao_Paulo");
    render(<PanelHost />);

    act(() => openPanel({ kind: "task", id: "t1" }));
    expect(panel()).toHaveAccessibleName(copy.panel.task);

    // MewChat portals its own panel into this slot (mew-chat.render.test).
    act(() => openPanel({ kind: "mew" }));
    expect(document.getElementById(MEW_PANEL_SLOT)).not.toBeNull();

    act(() => openPanel({ kind: "day", day: +zonedAt(2026, 10, 16) }));
    expect(panel()).toHaveAccessibleName("Segunda, 16 de novembro");
  });

  it("toggles open on the Mew, then closed", () => {
    render(<PanelHost />);
    act(() => togglePanel());
    expect(document.getElementById(MEW_PANEL_SLOT)).not.toBeNull();
    act(() => togglePanel());
    expect(document.getElementById(MEW_PANEL_SLOT)).toBeNull();
  });

  it("closes on Esc and on its close button", async () => {
    const user = userEvent.setup();
    render(<PanelHost />);

    act(() => openPanel({ kind: "task", id: "t1" }));
    await user.keyboard("{Escape}");
    expect(panel()).toBeNull();

    act(() => openPanel({ kind: "task", id: "t1" }));
    await user.click(screen.getByRole("button", { name: copy.panel.close }));
    expect(panel()).toBeNull();
  });

  it("leaves Esc to an open dialog above it", async () => {
    const user = userEvent.setup();
    render(
      <>
        <PanelHost />
        <div role="dialog" data-state="open" />
      </>,
    );
    act(() => openPanel({ kind: "task", id: "t1" }));
    await user.keyboard("{Escape}");
    expect(panel()).not.toBeNull();
  });
});
