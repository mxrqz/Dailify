/** @vitest-environment jsdom */
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { copy } from "@/components/dashboard/copy";

import MewPreview from "./mew-preview";

const t = copy.mewChat;
const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

beforeEach(() => {
  localStorage.clear();
  // Only the clock: motion keeps its real requestAnimationFrame.
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  // A Tuesday, so "sexta" is three days ahead.
  vi.setSystemTime(new Date(2026, 10, 17, 9, 0));
});
afterEach(() => vi.useRealTimers());

describe("/preview/mew", () => {
  it("opens the chat, runs a suggestion, confirms the move and undoes it", () => {
    render(
      <HelmetProvider>
        <MewPreview />
      </HelmetProvider>,
    );
    expect(screen.getByRole("region", { name: t.overdue })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: copy.composer.open }));
    const chat = screen.getByRole("dialog");
    fireEvent.click(within(chat).getByRole("button", { name: t.suggestions.overdue }));
    expect(within(chat).getByText(t.suggestions.overdue)).toBeInTheDocument();

    advance(5000);
    advance(1000);
    fireEvent.click(within(chat).getByRole("button", { name: t.box.confirm }));
    advance(1000);
    expect(within(chat).getByText("3 movidas para sexta-feira")).toBeInTheDocument();
    // The agenda behind the drawer reflects it.
    expect(screen.queryByRole("region", { name: t.overdue, hidden: true })).toBeNull();

    fireEvent.click(within(chat).getByRole("button", { name: t.box.undo }));
    advance(1000);
    expect(within(chat).getByText(t.box.undone)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: t.overdue, hidden: true })).toBeInTheDocument();
  });

  it("keeps the thread across reloads", () => {
    const { unmount } = render(
      <HelmetProvider>
        <MewPreview />
      </HelmetProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: copy.composer.open }));
    fireEvent.click(screen.getByRole("button", { name: t.suggestions.today }));
    advance(5000);
    advance(1000);
    unmount();

    render(
      <HelmetProvider>
        <MewPreview />
      </HelmetProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: copy.composer.open }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Você tem 3 coisas hoje:");
  });

  it("the chat types into the dashboard's dock, which stays outside the drawer and closes back", () => {
    render(
      <HelmetProvider>
        <MewPreview />
      </HelmetProvider>,
    );
    const dock = document.querySelector('[data-slot="create-dock"]');
    expect(dock).toContainElement(screen.getByRole("button", { name: copy.composer.open }));

    fireEvent.click(screen.getByRole("button", { name: copy.composer.open }));
    const field = screen.getByRole("textbox", { name: t.placeholder });
    // Same node, now the message box; the drawer opened under it, not around it.
    expect(document.querySelector('[data-slot="create-dock"]')).toBe(dock);
    expect(dock).toContainElement(field);
    expect(screen.getByRole("dialog")).not.toContainElement(field);
    expect(field).toHaveFocus();

    fireEvent.change(field, { target: { value: "o que tenho hoje?" } });
    fireEvent.click(screen.getByRole("button", { name: t.send }));
    advance(5000);
    advance(1000);
    expect(screen.getByRole("dialog")).toHaveTextContent("Você tem 3 coisas hoje:");

    fireEvent.click(screen.getByRole("button", { name: t.close }));
    expect(dock).toContainElement(screen.getByRole("button", { name: copy.composer.open }));
  });

  it("a reply lands whole: every word in the DOM on its first render, two lines tall at least", () => {
    render(
      <HelmetProvider>
        <MewPreview />
      </HelmetProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: copy.composer.open }));
    fireEvent.click(screen.getByRole("button", { name: t.suggestions.today }));
    // Typing beat, then the box's 120ms fade-out before it swaps in the text.
    advance(650);
    advance(120);

    const text = screen.getByRole("dialog").querySelector("p.min-h-2lh");
    expect(text).toHaveTextContent("Você tem 3 coisas hoje:");
    expect(text?.querySelectorAll("span")).toHaveLength(5);
  });

  it("a reply with a block is one container: text, rows and buttons in the same box", () => {
    render(
      <HelmetProvider>
        <MewPreview />
      </HelmetProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: copy.composer.open }));
    fireEvent.click(screen.getByRole("button", { name: t.suggestions.steps }));
    advance(5000);
    advance(1000);

    const chat = screen.getByRole("dialog");
    const box = within(chat).getByText("Separei").closest('[data-slot="message-box"]');
    expect(box).not.toBeNull();
    expect(box).toContainElement(within(chat).getByText("Confirmar o caminhão"));
    expect(box).toContainElement(within(chat).getByRole("button", { name: "Adicionar 5" }));
    expect(chat.querySelectorAll('[data-slot="message-box"]')).toHaveLength(1);
  });
});
