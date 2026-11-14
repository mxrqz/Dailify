import { TZDate } from "@date-fns/tz";

export const deviceTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

// Módulo e não contexto: datas nascem fora do React (parser, fila, api) e todas leem daqui.
let zone = deviceTimeZone();

/** O fuso em que o app calcula e mostra datas: o escolhido em Configurações, ou o do aparelho. */
export const appTimeZone = (): string => zone;

export function setAppTimeZone(next: string | null): void {
  zone = next ?? deviceTimeZone();
}

/** O `new Date()` do Dailify: o instante, lido no fuso do app (date-fns segue o fuso do TZDate). */
export const zoned = (value: number | Date = Date.now()): TZDate => new TZDate(+value, zone);

/** O `new Date(ano, mês, dia, …)` do Dailify, no fuso do app. */
export const zonedAt = (
  year: number,
  month: number,
  day = 1,
  hours = 0,
  minutes = 0,
  seconds = 0,
  ms = 0,
): TZDate => new TZDate(year, month, day, hours, minutes, seconds, ms, zone);

/** O "2026-10-23" do `<input type="date">` como meia-noite no fuso do app; vazio dá data inválida. */
export function fromDateInput(value: string): TZDate {
  const [year, month, day] = value.split("-").map(Number);
  return zonedAt(year, month - 1, day);
}
