import type { MewMood } from "@/components/mew/mew";

import type { Block, BoxBlock, Message } from "./thread";

export const isBox = (b: Block): b is BoxBlock => b.kind !== "tasks";

/** The header Mew reacts to the latest turn: thinks, waits for a confirmation, cheers, gets lost. */
export function moodOf(last: Message | undefined, busy: boolean): MewMood {
  if (last?.from !== "mew") return busy ? "thinking" : "idle";
  if (last.typing) return "thinking";
  const step = last.blocks.filter(isBox).at(-1)?.step;
  if (step === "draft") return "alert";
  if (step === "done") return "happy";
  if (last.intent === "notFound" || last.intent === "unsupported") return "confused";
  return "idle";
}
