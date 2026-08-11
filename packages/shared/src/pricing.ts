import type { Permissions, Role, Entitlements } from "./types";

export const PLAN_PERMISSIONS: Record<Role, Permissions> = {
  free: { taskLimits: { monthly: 30, recurring: 0 }, features: { voiceCreation: false } },
  pro: { taskLimits: { monthly: 300, recurring: -1 }, features: { voiceCreation: false } },
  "pro+ai": { taskLimits: { monthly: -1, recurring: -1 }, features: { voiceCreation: true } },
  admin: { taskLimits: { monthly: -1, recurring: -1 }, features: { voiceCreation: true } },
};

/**
 * Derives feature entitlements from the server-provided permissions (capability-based — never the
 * plan name). `permissions === undefined` = not loaded yet: premium features default OFF (so they
 * don't flash), but task creation is NOT blocked (don't lock out a paying user mid-load).
 */
export function computeEntitlements(
  permissions: Permissions | undefined,
  tasksUsed: number,
): Entitlements {
  const monthlyLimit = permissions?.taskLimits?.monthly ?? -1;
  const recurringLimit = permissions?.taskLimits?.recurring ?? 0;
  const unlimited = monthlyLimit < 0;
  const remaining = unlimited ? Infinity : Math.max(0, monthlyLimit - tasksUsed);

  return {
    loading: permissions === undefined,
    voice: permissions?.features?.voiceCreation ?? false,
    recurrence: recurringLimit !== 0, // 0 = not allowed; -1 (unlimited) or >0 = allowed
    monthlyLimit,
    unlimited,
    tasksUsed,
    remaining,
    canCreateTask: unlimited || remaining > 0,
  };
}
