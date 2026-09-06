import type { QuotaState } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";

/** Saiu o parâmetro da palavra de ilimitado: a copy já vinha de dentro, e os dois chamadores só
 *  repassavam a mesma constante deste mesmo arquivo. */
export function quotaLabel(state: QuotaState, name: string): string {
  if (state.unlimited) {
    return copy.quota.summaryUnlimited
      .replace("{used}", String(state.used))
      .replace("{name}", name);
  }

  return copy.quota.summary
    .replace("{used}", String(state.used))
    .replace("{limit}", String(state.limit))
    .replace("{name}", name);
}
