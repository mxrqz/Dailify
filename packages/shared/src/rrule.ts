import type { Task } from "./types";
import { dayMap, expandRecurringTask, weekDays } from "./recurrence";
import { zonedEpoch, zonedParts, type ZonedParts } from "./timezone";

/** A série da tarefa no formato do `recurrence` de um evento do Google. */
export type Recurrence = Pick<Task, "repeat" | "repeatEvery" | "repeatUntil" | "exdates">;

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (p: ZonedParts) => `${p.year}-${pad(p.month + 1)}-${pad(p.day)}`;
const wall = (p: ZonedParts) => `${ymd(p)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
const compact = (s: string) => s.replace(/[-:]/g, "");
const weekday = (p: ZonedParts) => new Date(Date.UTC(p.year, p.month, p.day)).getUTCDay();
const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** Dias 28..29–31 com BYSETPOS=-1: o último que o mês tiver, como o corte da Mewki. */
const clampDays = (day: number) => Array.from({ length: day - 27 }, (_, i) => 28 + i).join(",");

/**
 * A mesma série do `expandRecurringTask`, em linhas RRULE/EXDATE; `null` sem recorrência. `start` =
 * a hora de parede do início no `timeZone`. Tarefa Sem data é evento de dia inteiro: UNTIL e EXDATE
 * só com o dia.
 */
export function toRrule(task: Task, start: ZonedParts, timeZone: string): string[] | null {
  const { repeat } = task;
  if (repeat === "Off") return null;
  const every = task.repeatEvery && task.repeatEvery > 1 ? task.repeatEvery : 1;
  const rule = [`FREQ=${typeof repeat === "object" ? "WEEKLY" : repeat.toUpperCase()}`];
  if (every > 1) rule.push(`INTERVAL=${every}`);
  if (typeof repeat === "object") {
    const days = repeat.Weekly.map((d) => dayMap[d]).sort((a, b) => a - b);
    rule.push(`BYDAY=${days.map((d) => BYDAY[d]).join(",")}`);
    // A cada N semanas, a Mewki conta blocos de 7 dias a partir do dia da tarefa; com a semana do
    // RRULE começando nesse dia (WKST), os blocos batem.
    if (every > 1) rule.push(`WKST=${BYDAY[weekday(start)]}`);
  }
  // Dia 29–31: a Mewki corta pro último dia do mês curto, o RRULE puro pularia o mês.
  if ((repeat === "Monthly" || repeat === "Yearly") && start.day > 28) {
    if (repeat === "Yearly") rule.push(`BYMONTH=${start.month + 1}`);
    rule.push(`BYMONTHDAY=${clampDays(start.day)}`, "BYSETPOS=-1");
  }
  const day = (ms: number) => compact(ymd(zonedParts(ms, timeZone)));
  // Com horário o RFC exige UNTIL em UTC; no dia inteiro, só a data.
  const utc = (ms: number) => `${compact(new Date(ms).toISOString().slice(0, 19))}Z`;
  if (task.repeatUntil !== undefined)
    rule.push(`UNTIL=${task.undated ? day(task.repeatUntil) : utc(task.repeatUntil)}`);

  const lines = [`RRULE:${rule.join(";")}`];
  if (task.exdates?.length) {
    const dates = task.exdates.map((ms) =>
      task.undated ? day(ms) : compact(wall(zonedParts(ms, timeZone))),
    );
    lines.push(task.undated ? `EXDATE;VALUE=DATE:${dates}` : `EXDATE;TZID=${timeZone}:${dates}`);
  }
  return lines;
}

const DATE = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z?))?$/;

/** "20261231T120000Z" (UTC), "20261231T090000" (no `timeZone`) ou "20261231" (às `time`). */
function parseDate(
  value: string,
  timeZone: string,
  time: Omit<ZonedParts, "year" | "month" | "day">,
) {
  const m = DATE.exec(value);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  if (m[4] === undefined) return zonedEpoch({ year, month, day, ...time }, timeZone);
  const clock = {
    year,
    month,
    day,
    hour: Number(m[4]),
    minute: Number(m[5]),
    second: Number(m[6]),
  };
  return m[7]
    ? Date.UTC(year, month, day, clock.hour, clock.minute, clock.second)
    : zonedEpoch(clock, timeZone);
}

/** A data da n-ésima ocorrência (a 1ª é o início); além de 100 anos, `undefined` = sem fim. */
function nthDate(
  series: Recurrence,
  start: number,
  n: number,
  timeZone: string,
): number | undefined {
  const task: Task = {
    ...series,
    id: "",
    title: "",
    date: start,
    duration: "",
    priority: 0,
    completed: [],
  };
  const first = zonedParts(start, timeZone);
  const dates = [start];
  // ponytail: anda mês a mês expandindo; COUNT de série diária longa custa um loop de meses, ok
  // enquanto só o sync chama isto uma vez por evento.
  for (let i = 0; dates.length < n && i < 1200; i++) {
    const month = new Date(first.year, first.month + i, 1);
    for (const t of expandRecurringTask(task, month, timeZone))
      if (t.date > start) dates.push(t.date);
  }
  return dates[n - 1];
}

/**
 * O inverso do `toRrule`: o `recurrence` de um evento do Google → a série da Mewki, ou `null` quando
 * a regra não cabe no modelo (BYDAY com posição, RDATE, FREQ horária, dia 29–31 sem o corte…) e o
 * evento fica só na Agenda. `start` = início do evento; `timeZone` = o dele. COUNT vira UNTIL.
 */
export function fromRrule(
  recurrence: string[],
  start: number,
  timeZone: string,
): Recurrence | null {
  try {
    return parseRecurrence(recurrence, start, timeZone);
  } catch {
    return null; // TZID que o Intl não conhece
  }
}

function parseRecurrence(recurrence: string[], start: number, timeZone: string): Recurrence | null {
  const s = zonedParts(start, timeZone);
  const atStart = { hour: s.hour, minute: s.minute, second: s.second };
  let rule: Map<string, string> | undefined;
  const exdates: number[] = [];

  for (const line of recurrence) {
    const colon = line.indexOf(":");
    const [name, ...params] = line.slice(0, colon).split(";");
    const value = line.slice(colon + 1);
    if (name.toUpperCase() === "RRULE" && !rule) {
      rule = new Map(
        value.split(";").map((part): [string, string] => {
          const [k, v = ""] = part.split("=");
          return [k.toUpperCase(), v.toUpperCase()];
        }),
      );
    } else if (name.toUpperCase() === "EXDATE") {
      const tzid = params.find((p) => p.toUpperCase().startsWith("TZID="));
      for (const v of value.split(",")) {
        const ms = parseDate(v.trim(), tzid ? tzid.slice(5) : timeZone, atStart);
        if (ms === null) return null;
        exdates.push(ms);
      }
    } else return null;
  }
  if (!rule) return null;

  const known = [
    "FREQ",
    "INTERVAL",
    "BYDAY",
    "BYMONTHDAY",
    "BYMONTH",
    "BYSETPOS",
    "WKST",
    "UNTIL",
    "COUNT",
  ];
  if ([...rule.keys()].some((k) => !known.includes(k))) return null;
  const freq = rule.get("FREQ");
  const every = Number(rule.get("INTERVAL") ?? 1);
  if (!Number.isInteger(every) || every < 1 || every > 365) return null;
  const byday = rule.get("BYDAY");
  const bymonthday = rule.get("BYMONTHDAY");
  const bymonth = rule.get("BYMONTH");
  const bysetpos = rule.get("BYSETPOS");

  let repeat: Recurrence["repeat"];
  if (freq === "DAILY" && !byday && !bymonthday && !bymonth && !bysetpos) repeat = "Daily";
  else if (freq === "WEEKLY" && !bymonthday && !bymonth && !bysetpos) {
    const startDay = weekday(s);
    const days = byday ? byday.split(",").map((d) => BYDAY.indexOf(d)) : [startDay];
    const wkst = BYDAY.indexOf(rule.get("WKST") ?? "MO"); // o padrão do RFC
    if (days.some((d) => d < 0) || wkst < 0) return null; // "2TU" e afins
    // A cada N semanas: a Mewki conta blocos de 7 dias a partir do início; um dia que na semana do
    // RRULE vem antes do dia do início cairia no bloco anterior.
    const offset = (d: number) => (d - wkst + 7) % 7;
    if (every > 1 && days.some((d) => offset(d) < offset(startDay))) return null;
    repeat = { Weekly: weekDays.filter((_, i) => days.includes(i)) };
  } else if ((freq === "MONTHLY" || freq === "YEARLY") && !byday) {
    if (bymonth && (freq === "MONTHLY" || Number(bymonth) !== s.month + 1)) return null;
    if (bymonthday) {
      const clamped = s.day > 28 && bymonthday === clampDays(s.day) && bysetpos === "-1";
      if (!clamped && (s.day > 28 || bymonthday !== String(s.day) || bysetpos)) return null;
    } else if (bysetpos || (s.day > 28 && (freq === "MONTHLY" || s.month === 1))) return null;
    repeat = freq === "MONTHLY" ? "Monthly" : "Yearly";
  } else return null;

  const series: Recurrence = { repeat, ...(every > 1 && { repeatEvery: every }) };
  const until = rule.get("UNTIL");
  const count = rule.get("COUNT");
  if (until !== undefined && count !== undefined) return null;
  if (until !== undefined) {
    const ms = parseDate(until, timeZone, { hour: 23, minute: 59, second: 59, ms: 999 });
    if (ms === null) return null;
    series.repeatUntil = ms;
  } else if (count !== undefined) {
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1) return null;
    const last = nthDate(series, start, n, timeZone);
    if (last !== undefined) series.repeatUntil = last;
  }
  if (exdates.length) series.exdates = exdates;
  return series;
}
