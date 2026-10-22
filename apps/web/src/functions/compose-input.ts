import type { TaskInput } from "@dailify/shared";

import type { ParsedTask } from "./parse-task";

export const DEFAULT_HOUR = 9; // dia sem hora ("amanhã" puro) cai no começo do dia útil, não em 00:00
export const DEFAULT_DURATION = "10m";

/**
 * Onde a tarefa vai parar: só o que tem horário entra na agenda. Sem horário vai para Sem data —
 * com lembrete às 09:00 se citou um dia, sem lembrete se não citou. `undatedOnly` (composer da
 * coluna Sem data) ignora a hora do parser.
 */
export function composeTaskInput(
  parsed: ParsedTask,
  now: Date,
  opts: { undatedOnly?: boolean } = {},
): TaskInput {
  const base = {
    title: parsed.text,
    duration: parsed.duration ?? DEFAULT_DURATION,
    priority: 0,
    repeat: parsed.repeat,
    links: parsed.links.length ? parsed.links : undefined,
  };

  if (parsed.date && parsed.hasTime && !opts.undatedOnly) {
    return { ...base, date: parsed.date.getTime() };
  }

  if (parsed.date && parsed.hasDay) {
    // Cópia: `parsed.date` é o mesmo objeto que o composer usa pros chips.
    const date = new Date(parsed.date).setHours(DEFAULT_HOUR, 0, 0, 0);
    return { ...base, date, alert: date, undated: true };
  }

  return { ...base, date: now.getTime(), undated: true };
}
