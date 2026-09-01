import type { QuotaState } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";

export function quotaLabel(state: QuotaState, name: string, unlimitedWord: string): string {
  return copy.quota.summary
    .replace("{used}", String(state.used))
    .replace("{limit}", state.unlimited ? unlimitedWord : String(state.limit))
    .replace("{name}", name);
}
