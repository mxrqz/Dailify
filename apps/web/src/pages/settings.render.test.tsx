/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HelmetProvider } from "react-helmet-async";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const native = vi.hoisted(() => ({
  nativeReminders: vi.fn(() => false),
  openAssistantSettings: vi.fn(),
}));
vi.mock("@/lib/reminders", () => native);
vi.mock("@/functions/push", () => ({
  pushState: () => Promise.resolve("on"),
  enablePush: vi.fn(),
}));
// The widgets have their own tests; this page test is about its own rows.
vi.mock("@/components/integrations", () => ({ IntegrationsSummary: () => null }));
vi.mock("@/components/hour-format-select", () => ({ HourFormatSelect: () => null }));
vi.mock("@/components/theme-select", () => ({ ThemeSelect: () => null }));
vi.mock("@/components/push-toggle", () => ({ PushToggle: () => null }));
vi.mock("@/components/time-zone-select", () => ({ TimeZoneSelect: () => null }));
vi.mock("@/components/week-start-select", () => ({ WeekStartSelect: () => null }));

import { copy } from "@/components/dashboard/copy";
import { copy as intro } from "@/components/onboarding/copy";
import { ONBOARDING_KEY, Onboarding } from "@/components/onboarding/onboarding";

import SettingsPage from "./settings";

const setup = () =>
  render(
    <HelmetProvider>
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/dashboard" element={<Onboarding onTry={vi.fn()} />} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  native.nativeReminders.mockReturnValue(false);
  native.openAssistantSettings.mockResolvedValue(undefined);
});

describe("SettingsPage", () => {
  it("Rever introdução clears the seen flag and reopens the intro", async () => {
    localStorage.setItem(ONBOARDING_KEY, "1");
    setup();
    await userEvent.click(screen.getByRole("button", { name: copy.profile.replayIntro }));
    expect(
      await screen.findByRole("dialog", { name: intro.steps.welcome.title }),
    ).toBeInTheDocument();
  });

  it("the phone assistant row shows only in the Android app and opens the system picker", async () => {
    setup().unmount();
    expect(screen.queryByRole("button", { name: copy.profile.assistantTitle })).toBeNull();

    native.nativeReminders.mockReturnValue(true);
    setup();
    await userEvent.click(screen.getByRole("button", { name: copy.profile.assistantTitle }));
    expect(native.openAssistantSettings).toHaveBeenCalled();
  });
});
