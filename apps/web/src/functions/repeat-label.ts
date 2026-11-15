import { dayMap, type Repeat } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";

/**
 * Rótulo curto da recorrência pro chip do cartão — "" quando não repete, que é o sinal de "não
 * renderize o chip". `Weekly` com dias vira as abreviações na ordem da semana ("Seg, Qua"); só o
 * dia é que informa alguma coisa, "Semanal" sozinho não diz quando. Com `every` > 1 o intervalo
 * vem na frente: "A cada 2 semanas (seg, qua)".
 */
export function repeatLabel(repeat: Repeat, every = 1): string {
  if (repeat === "Off") return "";
  const days =
    typeof repeat === "object"
      ? repeat.Weekly.filter((day) => day in dayMap)
          .sort((a, b) => dayMap[a] - dayMap[b])
          .map((day) => copy.form.repeatDays[dayMap[day]])
          .join(", ")
      : "";

  if (every > 1) {
    if (repeat === "Daily" && every === 2) return copy.form.repeatEveryOther;
    const unit = typeof repeat === "object" ? "Weekly" : repeat;
    const label = copy.form.repeatEveryUnit[unit].replace("{n}", String(every));
    return days ? `${label} (${days.toLowerCase()})` : label;
  }

  if (repeat === "Daily") return copy.form.repeatDaily;
  if (repeat === "Monthly") return copy.form.repeatMonthly;
  if (repeat === "Yearly") return copy.form.repeatYearly;
  return days || copy.form.repeatWeekly;
}

/** Só a unidade e o intervalo, sem os dias: as opções do seletor "a cada N". */
export const everyLabel = (repeat: Repeat, every: number): string =>
  repeatLabel(typeof repeat === "object" ? { Weekly: [] } : repeat, every);

/** Os intervalos oferecidos, mais o atual quando é um fora da régua (como `DURATIONS`). */
const REPEAT_EVERY = [1, 2, 3, 4, 6];
export const everyOptions = (every: number): number[] =>
  REPEAT_EVERY.includes(every) ? REPEAT_EVERY : [...REPEAT_EVERY, every].sort((a, b) => a - b);
