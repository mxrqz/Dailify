import { describe, expect, it } from "vitest";

import { onboardingSteps } from "./steps";

describe("onboardingSteps", () => {
  it("shows all six steps in the Android app with reminders off", () => {
    expect(onboardingSteps({ android: true, notifications: "off" })).toEqual([
      "welcome",
      "create",
      "mew",
      "notifications",
      "assistant",
      "done",
    ]);
  });

  it("drops the reminders step when they are on, denied or unsupported", () => {
    for (const notifications of ["on", "denied", "unsupported"] as const)
      expect(onboardingSteps({ android: false, notifications })).not.toContain("notifications");
  });

  it("keeps the reminders step while their state is still unknown", () => {
    expect(onboardingSteps({ android: false, notifications: null })).toContain("notifications");
  });

  it("shows the assistant step only in the Android app", () => {
    expect(onboardingSteps({ android: false, notifications: "off" })).toEqual([
      "welcome",
      "create",
      "mew",
      "notifications",
      "done",
    ]);
  });
});
