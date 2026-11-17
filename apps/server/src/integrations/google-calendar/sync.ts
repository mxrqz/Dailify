import type { Env } from "../../index";

/**
 * Traz os eventos da agenda principal pra Mewki (import + sync incremental pelo syncToken).
 * `full` ignora o token e relê desde 30 dias atrás. O motor chega na Fase 1A; até lá não importa nada.
 */
export const syncCalendar: (
  env: Env,
  userId: string,
  opts?: { full?: boolean },
) => Promise<{ imported: number }> = async () => ({ imported: 0 });
