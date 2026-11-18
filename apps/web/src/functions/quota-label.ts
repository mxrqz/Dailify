import type { QuotaState } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { fill } from "./functions";

export function quotaLabel(state: QuotaState, name: string): string {
  const { used, limit } = state;
  return state.unlimited
    ? fill(copy.quota.summaryUnlimited, { used, name })
    : fill(copy.quota.summary, { used, limit, name });
}
