import { useDailify } from "@/components/dailifyContext";
import { computeEntitlements, type Entitlements } from "@dailify/shared";

/**
 * Single source of truth for feature gating. Reads the server-provided permissions from context and
 * returns capability flags — gate the UI on THESE, never on the plan name. See epic d69.
 *
 * `tasksUsed` counts distinct base tasks (recurring instances share an id, so they count once).
 * Remember: this is UX only; real enforcement is server-side (d69.5).
 */
export function useEntitlements(): Entitlements {
  const { permissions, tasks } = useDailify();
  const tasksUsed = tasks ? new Set(tasks.map((t) => t.id)).size : 0;
  return computeEntitlements(permissions, tasksUsed);
}
