import type { PushState } from "@/functions/push";

export type OnboardingStep = "welcome" | "create" | "mew" | "notifications" | "assistant" | "done";

/**
 * The steps this device shows. Reminders only when they can still be turned on here (`null` =
 * not read yet, kept so the dots don't jump); the assistant only in the Android app.
 */
export function onboardingSteps({
  android,
  notifications,
}: {
  android: boolean;
  notifications: PushState | null;
}): OnboardingStep[] {
  return [
    "welcome",
    "create",
    "mew",
    ...(notifications === null || notifications === "off" ? (["notifications"] as const) : []),
    ...(android ? (["assistant"] as const) : []),
    "done",
  ];
}
