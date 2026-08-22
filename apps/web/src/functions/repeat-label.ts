import { dayMap, type Repeat } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";

/**
 * Rótulo curto da recorrência pro chip do cartão — "" quando não repete, que é o sinal de "não
 * renderize o chip". `Weekly` com dias vira as abreviações na ordem da semana ("Seg, Qua"); só o
 * dia é que informa alguma coisa, "Semanal" sozinho não diz quando.
 */
export function repeatLabel(repeat: Repeat): string {
  if (repeat === "Off") return "";
  if (repeat === "Daily") return copy.form.repeatDaily;
  if (repeat === "Monthly") return copy.form.repeatMonthly;
  if (repeat === "Yearly") return copy.form.repeatYearly;

  const days = repeat.Weekly.filter((day) => day in dayMap).sort((a, b) => dayMap[a] - dayMap[b]);
  if (!days.length) return copy.form.repeatWeekly;
  return days.map((day) => copy.form.repeatDays[dayMap[day]]).join(", ");
}
