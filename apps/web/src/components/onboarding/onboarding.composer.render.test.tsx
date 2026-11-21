/** @vitest-environment jsdom */
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/functions/push", () => ({
  pushState: () => Promise.resolve("on"),
  enablePush: vi.fn(),
}));
vi.mock("@/lib/reminders", () => ({
  nativeReminders: () => false,
  openAssistantSettings: vi.fn(),
}));
vi.mock("@/components/dailifyContext", () => ({ useDailify: () => ({ hour12: false }) }));
vi.mock("@/hooks/useVoiceCreate", () => ({
  MAX_RECORDING_MS: 60_000,
  useVoiceCreate: () => ({ state: "idle", start: vi.fn(), stop: vi.fn() }),
  voiceSupported: () => false,
}));
vi.mock("@/hooks/useMewParse", () => ({
  useMewParse: () => ({
    pending: false,
    result: null,
    exhausted: false,
    remaining: null,
    ask: vi.fn(),
    reset: vi.fn(),
  }),
}));
vi.mock("@/hooks/useCreateTask", () => ({
  useCreateTask: () => ({ createMany: vi.fn(), submitting: false }),
}));
vi.mock("@/hooks/useIntegrations", () => ({ useCalendarReady: () => false }));
vi.mock("@/components/mew-chat/mew-chat", () => ({ MewChat: () => null }));

import { CreateFab } from "@/components/dashboard/create-fab";
import { COMPOSER_TEXT_ID } from "@/components/dashboard/task-composer";

import { copy } from "./copy";
import { Onboarding } from "./onboarding";

// Home's wiring: the intro's suggestion becomes the composer's `text`, as the first-run example.
function Home() {
  const [example, setExample] = useState<string | null>(null);
  return (
    <>
      <CreateFab onSubmit={vi.fn()} text={example} onDayDone={() => setExample(null)} />
      <Onboarding onTry={setExample} />
    </>
  );
}

describe("<Onboarding> suggestions", () => {
  it("a suggestion chip opens the composer holding its text", async () => {
    localStorage.clear();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<Home />);
    await user.click(await screen.findByRole("button", { name: copy.start }));
    await user.click(screen.getByRole("button", { name: copy.next }));
    await user.click(screen.getByRole("button", { name: copy.next }));
    await user.click(await screen.findByRole("button", { name: copy.suggestions[1] }));

    const field = await screen.findByDisplayValue(copy.suggestions[1]);
    expect(field).toHaveAttribute("id", COMPOSER_TEXT_ID);
  });
});
