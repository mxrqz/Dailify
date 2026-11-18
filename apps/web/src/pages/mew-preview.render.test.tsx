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
    unmount();

    render(
      <HelmetProvider>
        <MewPreview />
      </HelmetProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: copy.composer.open }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Você tem 3 coisas hoje:");
  });
});
