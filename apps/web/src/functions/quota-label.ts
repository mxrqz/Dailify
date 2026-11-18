import type { QuotaState } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { countLabel } from "./count-label";
import { fill } from "./functions";

export function quotaLabel(state: QuotaState, name: string): string {
  const { used, limit } = state;
  return state.unlimited
    ? fill(copy.quota.summaryUnlimited, { used, name })
    : fill(copy.quota.summary, { used, limit, name });
}

/** "1 restante", "12 restantes". */
export const remainingLabel = (remaining: number): string =>
  countLabel(remaining, copy.mew.remainingOne, copy.mew.remainingMany);

/** "Créditos de IA · 12 restantes", or the exhausted line; null when AI is unlimited. */
export function creditsLabel(
  ai: Pick<QuotaState, "unlimited" | "exhausted" | "remaining">,
): string | null {
  if (ai.unlimited) return null;
  return ai.exhausted
    ? copy.mew.exhausted
    : fill(copy.mew.credits, { left: remainingLabel(ai.remaining) });
}
