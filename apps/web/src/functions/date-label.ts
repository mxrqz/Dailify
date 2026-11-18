import {
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameWeek,
  isToday,
  isTomorrow,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import type { WeekStart } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { capitalize, formatClock } from "./functions";
import { zoned } from "./zone";

/** "16:45" (or "04:45 PM") of an instant, read in the app zone. */
export const clockAt = (at: number | Date, hour12: boolean): string =>
  formatClock(format(zoned(at), "HH:mm"), hour12);

/** "Terça, 17 nov": date-fns in pt-BR, capitalized and without "-feira". */
export const weekdayDate = (day: Date, pattern: string): string =>
  capitalize(format(day, pattern, { locale: ptBR }).replace("-feira", ""));

// EEEEEE, not EEE: in pt-BR `EEE` spells the whole weekday ("segunda").
/** "ter. · 17 nov". */
export const dayDot = (day: Date): string => format(day, "EEEEEE · d MMM", { locale: ptBR });

/** "Ter, 17 nov". */
export const dayComma = (day: Date): string =>
  capitalize(format(day, "EEEEEE, d MMM", { locale: ptBR }));

/**
 * Today is "Agenda" (the page is already Hoje), tomorrow has its own name, the rest of the current
 * week is the weekday and later days carry the date: "sexta" only places a day inside the week.
 */
export function dayLabel(day: Date, now: Date, weekStart: WeekStart): string {
  if (isToday(day)) return copy.day.agenda;
  if (isTomorrow(day)) return copy.day.tomorrow;
  if (!isSameWeek(day, now, { weekStartsOn: weekStart })) return weekdayDate(day, "EEEE, d MMM");
  return weekdayDate(day, "EEEE");
}

/** The weekday initials starting at the configured first day (the copy list is Sunday-first). */
export const weekdayInitials = (weekStart: WeekStart): string[] =>
  copy.aside.weekDayInitials.map((_, i) => copy.aside.weekDayInitials[(i + weekStart) % 7]);

/** The seven days of `day`'s week. */
export function weekOf(day: Date, weekStart: WeekStart): Date[] {
  const opts = { weekStartsOn: weekStart };
  return eachDayOfInterval({ start: startOfWeek(day, opts), end: endOfWeek(day, opts) });
}
