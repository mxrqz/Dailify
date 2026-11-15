import type { TZDate } from "@date-fns/tz";
import { weekDays } from "../recurrence";
import type { Repeat } from "../types";
import { MONTH_FIRST_RE } from "./dates";
import { type Span, hit, spanOf } from "./spans";
import {
  HOUR_WORDS,
  HOUR_WORD_RE,
  MONTH_RE,
  PERIOD_HOURS,
  WEEKDAYS,
  WEEKDAY_RE,
  alternation,
  dateIn,
  startOfDay,
} from "./vocab";

const WEEKDAY_ITEM = `(?:${WEEKDAY_RE})s?(?:(?<!sabados?|domingos?)\\s*feiras?)?\\b`;
// Plural só dos nomes inteiros: "tues"/"thurs" já terminam em s.
const PLURAL_WEEKDAY = `(?:${alternation(
  Object.keys(WEEKDAYS).filter((key) => key.length > 3 && !["thur", "thurs", "tues"].includes(key)),
)})s(?:\\s*feiras)?\\b`;
const LIST_SEP = String.raw`(?:\s*[,/]\s*|\s+(?:e|and)\s+|\s+)`;
const EVERY = String.raw`(?:tod[ao]s?|td[ao]?s?)`;

/** Os dias da semana citados no trecho, em ordem e sem repetir. */
function weekdaysIn(text: string): number[] {
  const days = [...text.matchAll(new RegExp(`\\b(${WEEKDAY_RE})s?\\b`, "g"))];
  return [...new Set(days.map((day) => WEEKDAYS[day[1]]))].sort((a, b) => a - b);
}
export const weekly = (indexes: number[]) => ({ Weekly: indexes.map((i) => weekDays[i]) });
const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6];

// "of every month" depois de "on the 5th" (ou "todo dia 5 de cada mês") é a mesma série, e sai junto.
const MONTHLY_SOURCE = String.raw`\b(?:(?:de|of)\s+)?(?:tod[ao]s?\s+(?:os\s+)?mes(?:es)?|mensalmente|(?:a\s+)?cada\s+mes|every\s+month|uma\s+vez\s+(?:por|ao)\s+mes|once\s+a\s+month)\b`;
const MONTHLY_RE = new RegExp(MONTHLY_SOURCE);

const RECURRENCES: [RegExp, (match: RegExpMatchArray, now: Date) => Exclude<Repeat, "Off">][] = [
  // todo dia exceto domingo
  [
    new RegExp(
      `\\b(?:${EVERY}\\s+(?:os\\s+)?dias?|every\\s*day|diariamente|daily)\\s+(?:exceto|menos|fora|except|but)\\s+(?:(?:[ao]s?|on)\\s+)?${WEEKDAY_ITEM}(?:${LIST_SEP}${WEEKDAY_ITEM})*`,
    ),
    (match) => {
      const skip = weekdaysIn(match[0]);
      return weekly(ALL_WEEK.filter((i) => !skip.includes(i)));
    },
  ],
  // de segunda a sexta · monday through friday
  [
    new RegExp(
      `\\b(?:(?:de|from)\\s+)?(${WEEKDAY_RE})(?:\\s*feira)?\\s+(?:a|ate|to|through|thru)\\s+(${WEEKDAY_RE})(?:\\s*feira)?\\b`,
    ),
    (match) => {
      const [from, to] = [WEEKDAYS[match[1]], WEEKDAYS[match[2]]];
      return weekly(
        ALL_WEEK.filter((i) => (from <= to ? i >= from && i <= to : i >= from || i <= to)),
      );
    },
  ],
  [
    new RegExp(
      `\\b(?:${EVERY}\\s+(?:[ao]s\\s+)?|every\\s+|each\\s+)${WEEKDAY_ITEM}(?:${LIST_SEP}${WEEKDAY_ITEM})*`,
    ),
    (match) => weekly(weekdaysIn(match[0])),
  ],
  // às segundas · aos sábados · on Mondays · segundas e quartas · seg qua sex · Fridays 4pm
  // ("Tuesdays with Morrie" é título: o plural solto só vale antes de hora ou no fim)
  [
    new RegExp(
      `\\b(?:(?:[ao]s|aos|nas|nos|on)\\s+${PLURAL_WEEKDAY}|${WEEKDAY_ITEM}(?=${LIST_SEP}${WEEKDAY_ITEM})|${PLURAL_WEEKDAY}(?=\\s*$|\\s*[,.;]|\\s+(?:at|as|@|\\d)))(?:${LIST_SEP}${WEEKDAY_ITEM})*`,
    ),
    (match) => weekly(weekdaysIn(match[0])),
  ],
  [
    new RegExp(
      `\\b(?:${EVERY}\\s+(?:os\\s+)?dias?\\s+(?:util|uteis)|dias\\s+uteis|every\\s+weekday|weekdays|durante\\s+a\\s+semana)\\b`,
    ),
    () => weekly([1, 2, 3, 4, 5]),
  ],
  [
    new RegExp(
      `\\b(?:(?:${EVERY}\\s+(?:os\\s+)?|n[oa]s\\s+|every\\s+|on\\s+)(?:fim|fins|final|finais)\\s+de\\s+semanas?|(?:every|on)\\s+weekends?|weekends)\\b`,
    ),
    () => weekly([0, 6]),
  ],
  // "todo dia 5" é mensal; o span pega só o "todo" pro parseWhen ainda ler o "dia 5". "22h" é hora.
  [/\btod[ao](?=\s+dia\s+\d{1,2}\b(?!\s*(?:h|:|am|pm)))/, () => "Monthly"],
  [/\btod[ao](?=\s+(?:comeco|inicio)\s+d[oe]\s+mes\b)/, () => "Monthly"],
  [/\bevery(?=\s+\d{1,2}(?:st|nd|rd|th)\b)/, () => "Monthly"],
  // todo 1º de dezembro · todo 20/11 · every April 15
  [
    new RegExp(
      `\\btod[ao](?=\\s+(?:\\d{1,2}(?:[ºª]|o)?\\s+de\\s+(?:${MONTH_RE})\\b|\\d{1,2}\\/\\d{1,2}\\b))|\\bevery(?=\\s+(?:${MONTH_FIRST_RE})\\s+\\d)`,
    ),
    () => "Yearly",
  ],
  [
    /\b(?:(?:tod[ao]s?|td[ao]?s?)\s+(?:os\s+)?(?:santo\s+)?dias?|(?:a\s+)?cada\s+dia|diariamente|every\s*day|each\s+day)\b/,
    () => "Daily",
  ],
  [
    /\b(?:tod[ao]s?\s+(?:as\s+)?semanas?|semanalmente|every\s+week|(?:a\s+)?cada\s+semana|uma\s+vez\s+por\s+semana|once\s+a\s+week)\b/,
    (_, now) => weekly([now.getDay()]),
  ],
  [MONTHLY_RE, () => "Monthly"],
  [
    /\b(?:tod[ao]s?\s+(?:os\s+)?anos?|anualmente|annually|every\s+year|(?:a\s+)?cada\s+ano|uma\s+vez\s+por\s+ano|once\s+a\s+year)\b/,
    () => "Yearly",
  ],
];

// "take meds daily", e não "daily standup"/"weekly report": o advérbio inglês só vale no fim da
// frase ou antes da hora.
// "daily journaling" abre com o hábito (gerúndio), que não é nome de reunião como "daily meeting".
const ADVERB_RE =
  /(?<=\S\s+)\b(daily|weekly|monthly|yearly|annually)\b(?=\s*$|\s*[,.;!]|\s+(?:at|as|on|@|\d))|^\s*(daily|weekly|monthly)\b(?=\s+[a-z]+ing\b)(?!\s+(?:meeting|briefing|evening|morning|building|wedding)\b)/;

// todas as manhãs · toda noite · every morning: diária com a hora do período
const DAILY_PERIOD_RE =
  /\b(?:(?:tod[ao]s?|td[ao]?s?)\s+(?:as\s+)?|every\s+|each\s+)(manhas?|tardes?|noites?|madrugadas?|morning|afternoon|evening|night)\b/;

const EXCEPT_RE = new RegExp(
  `^\\s+(?:exceto|menos|except|but\\s+not)\\s+(?:(?:[ao]s?|on)\\s+)?${WEEKDAY_ITEM}(?:${LIST_SEP}${WEEKDAY_ITEM})*`,
);
const WEEKLY_PERIOD_RE =
  /^\s+(?:(?:a|de|da|in\s+the)\s+)?(manhas?|tardes?|noites?|madrugadas?|morning|afternoon|evening|night)\b/;

function periodWordHour(word: string): number {
  if (/^(?:manha|morning)/.test(word)) return PERIOD_HOURS.morning;
  if (/^(?:tarde|afternoon)/.test(word)) return PERIOD_HOURS.afternoon;
  return /^madrugada/.test(word) ? PERIOD_HOURS.dawn : PERIOD_HOURS.evening;
}

/** Recorrência no texto já normalizado; sem gatilho ("toda", "every", "diariamente"…) é `null`.
 * `hour` vem de "todas as manhãs": a série diz a hora quando o texto não diz. `original` (o input
 * antes do normalize) só serve pro traço de "mon-fri". */
export function parseRepeat(
  text: string,
  now: TZDate,
  original = text,
): RepeatHit | null {
  const dashed = text.match(new RegExp(`\\b(${WEEKDAY_RE}) (${WEEKDAY_RE})\\b`));
  if (dashed && /[-–—]/.test(original[(dashed.index ?? 0) + dashed[1].length])) {
    const [from, to] = [WEEKDAYS[dashed[1]], WEEKDAYS[dashed[2]]];
    if (from < to) return hit(dashed, weekly(ALL_WEEK.filter((i) => i >= from && i <= to)));
  }

  const daily = text.match(DAILY_PERIOD_RE);
  if (daily) return { ...hit(daily, "Daily"), hour: periodWordHour(daily[1]) };

  const adverb = text.match(ADVERB_RE);
  if (adverb) {
    const word = adverb[1] ?? adverb[2];
    return hit(
      adverb,
      word === "daily"
        ? "Daily"
        : word === "weekly"
          ? weekly([now.getDay()])
          : word === "monthly"
            ? "Monthly"
            : "Yearly",
    );
  }

  for (const [re, toRepeat] of RECURRENCES) {
    const match = text.match(re);
    if (!match) continue;
    let value = toRepeat(match, now);
    const [start, end] = spanOf(match);
    const extra =
      value === "Monthly"
        ? [...text.matchAll(new RegExp(MONTHLY_SOURCE, "g"))]
            .map(spanOf)
            .filter(([s, e]) => e <= start || s >= end)
        : [];
    if (typeof value !== "object") return hit(match, value, extra);

    // "dias úteis exceto quarta" · "every weekday except wed": a exceção sai do conjunto.
    let tail = end;
    const except = text.slice(tail).match(EXCEPT_RE);
    if (except) {
      const skip = weekdaysIn(except[0]).map((i) => weekDays[i]);
      value = { Weekly: value.Weekly.filter((day) => !skip.includes(day)) };
      tail += except[0].length;
    }
    // "every thursday night": o período colado na série é a hora dela, como em "toda noite".
    const period = text.slice(tail).match(WEEKLY_PERIOD_RE);
    if (period) extra.push([tail, tail + period[0].length]);
    if (tail > end) extra.push([end, tail]);
    return { ...hit(match, value, extra), hour: period ? periodWordHour(period[1]) : undefined };
  }
  return null;
}

export type RepeatHit = {
  value: Exclude<Repeat, "Off">;
  spans: Span[];
  hour?: number;
  /** `Task.repeatEvery`: ausente = 1. */
  every?: number;
};

const INTERVAL_UNIT = String.raw`(dias?|days?|semanas?|weeks?|mes|meses|months?|anos?|years?)\b(?!\s+(?:uteis|util)\b)`;
const EVERY_PREFIX = String.raw`(?:tod[ao]s?\s+(?:[ao]s\s+)?)?`;
const DAYS_TAIL_RE = new RegExp(
  `^\\s*,?\\s+(?:(?:on|n[ao]s?|[ao]s|aos)\\s+)?${WEEKDAY_ITEM}(?:${LIST_SEP}${WEEKDAY_ITEM})*`,
);

function unitRepeat(unit: string, now: Date): Exclude<Repeat, "Off"> {
  if (/^(?:dia|day)/.test(unit)) return "Daily";
  if (/^(?:semana|week)/.test(unit)) return weekly([now.getDay()]);
  return /^(?:mes|month)/.test(unit) ? "Monthly" : "Yearly";
}

const count = (raw: string) => (raw === "other" ? 2 : (HOUR_WORDS[raw] ?? Number(raw)));

// "toda semana" com N: a cada 2 semanas · de 15 em 15 dias · dia sim, dia não · quinzenal ·
// every other monday. Hora (de 8 em 8 horas) e "a cada 2 dias úteis" ficam pro UNSUPPORTED_REPEAT_RE.
const INTERVALS: [RegExp, (match: RegExpMatchArray, now: Date) => [Exclude<Repeat, "Off">, number]][] = [
  [
    new RegExp(String.raw`\b(?:de|a\s+cada)\s+(\d{1,3})\s+em\s+\1\s+${INTERVAL_UNIT}`),
    (m, now) => [unitRepeat(m[2], now), Number(m[1])],
  ],
  [
    new RegExp(
      String.raw`\b(?:(?:de|of)\s+)?(?:(?:a\s+)?cada|every|each)\s+(\d{1,3}|other|${HOUR_WORD_RE})\s*${INTERVAL_UNIT}`,
    ),
    (m, now) => [unitRepeat(m[2], now), count(m[1])],
  ],
  [
    new RegExp(`\\bevery\\s+other\\s+${WEEKDAY_ITEM}(?:${LIST_SEP}${WEEKDAY_ITEM})*`),
    (m) => [weekly(weekdaysIn(m[0])), 2],
  ],
  [
    new RegExp(
      `\\b${EVERY_PREFIX}(${WEEKDAY_RE})(?:\\s*feiras?)?\\s+sim,?\\s+(?:${WEEKDAY_RE})(?:\\s*feiras?)?\\s+nao\\b`,
    ),
    (m) => [weekly([WEEKDAYS[m[1]]]), 2],
  ],
  [
    new RegExp(
      String.raw`\b${EVERY_PREFIX}semanas?\s+sim,?\s+semanas?\s+nao\b|\b(?:(?:de|em)\s+)?semanas\s+alternadas\b|\balternate\s+weeks\b|\b(?:quinzenal(?:mente)?|${EVERY_PREFIX}quinzenas?|(?:a\s+)?cada\s+quinzena|bi\s*weekly|fortnightly|every\s+fortnight)\b`,
    ),
    (_, now) => [weekly([now.getDay()]), 2],
  ],
  [
    new RegExp(
      String.raw`\b${EVERY_PREFIX}dias?\s+sim,?\s+dias?\s+nao\b|\b(?:em\s+)?dias\s+alternados\b|\b(?:on\s+)?alternate\s+days\b`,
    ),
    () => ["Daily", 2],
  ],
  [new RegExp(String.raw`\b${EVERY_PREFIX}mes\s+sim,?\s+mes\s+nao\b|\bbimestralmente\b`), () => ["Monthly", 2]],
  [
    /\btrimestralmente\b|(?<=\S\s+)\bquarterly\b(?=\s*$|\s*[,.;!]|\s+(?:at|as|on|@|\d))|\bevery\s+quarter\b/,
    () => ["Monthly", 3],
  ],
  [/\bsemestralmente\b/, () => ["Monthly", 6]],
];

const ORDINAL_OF_EVERY_RE =
  /\b(?:first|second|third|fourth|last|primeir[ao]|segund[ao]|terceir[ao]|quart[ao]|(?:pen)?ultim[ao])\s+(?:\S+\s+)?(?:of|d[aoe])\s+(?:(?:a\s+)?cada|every|each)\b/;

/** Série com intervalo; `null` quando não há, ou quando o N não cabe em `repeatEvery` (1..365). */
export function parseInterval(text: string, now: Date): RepeatHit | null {
  for (const [re, read] of INTERVALS) {
    const match = text.match(re);
    if (!match) continue;
    // "the first of every other month", "última sexta de cada 2 meses": dia ordinal por extenso
    // não cabe no `Repeat`, e o UNSUPPORTED_REPEAT_RE ainda vê o intervalo.
    if (ORDINAL_OF_EVERY_RE.test(text)) return null;
    let [value, every] = read(match, now);
    if (!Number.isInteger(every) || every < 1 || every > 365) return null;
    const extra: Span[] = [];
    // "a cada 2 semanas na segunda e quarta": os dias colados são os da série.
    const end = spanOf(match)[1];
    const days = typeof value === "object" && text.slice(end).match(DAYS_TAIL_RE);
    if (days) {
      value = weekly(weekdaysIn(`${match[0]} ${days[0]}`));
      extra.push([end, end + days[0].length]);
    }
    return { ...hit(match, value, extra), every: every > 1 ? every : undefined };
  }
  return null;
}

/** A primeira ocorrência da série a partir de `date` — hoje vale se a hora não passou (ou não há hora). */
export function nextOccurrence(
  repeat: Exclude<Repeat, "Off">,
  date: Date,
  hasTime: boolean,
  now: Date,
) {
  const passed = (d: Date) => (hasTime ? d < now : d < startOfDay(now));
  const shift = (days: number, months = 0, years = 0) =>
    dateIn(
      date,
      date.getFullYear() + years,
      date.getMonth() + months,
      date.getDate() + days,
      date.getHours(),
      date.getMinutes(),
    );

  if (typeof repeat === "object") {
    for (let i = 0; i <= 7; i++) {
      const candidate = shift(i);
      if (repeat.Weekly.includes(weekDays[candidate.getDay()]) && !passed(candidate)) {
        return candidate;
      }
    }
    return date;
  }
  if (!passed(date)) return date;
  if (repeat === "Daily") return shift(1);
  return repeat === "Monthly" ? shift(0, 1) : shift(0, 0, 1);
}

const ORDINAL_WORD = String.raw`(?:primeir|segund|terceir|quart|penultim|ultim)[ao]s?|first|second|third|fourth|last|1st|2nd|3rd|4th`;
const COUNT = String.raw`(?:\d{1,3}|${HOUR_WORD_RE}|other)`;
const UNIT = String.raw`(?:h|hrs?|horas?|hours?|min|minutos?|minutes?|dias?|days?|semanas?|weeks?|mes|meses|months?|anos?|years?)`;
// Séries que o `Repeat` não guarda: de 8 em 8 horas · a cada 15 dias · quinzenalmente · dia sim dia
// não · 2x por semana · toda última sexta do mês · first monday of every month. Ficam no título, sem
// data nem série — leitura confiante aqui seria dado errado (a fase 4 marca como dúvida).
export const UNSUPPORTED_REPEAT_RE = new RegExp(
  [
    String.raw`\b(?:de|a\s+cada)\s+\d{1,3}\s+em\s+\d{1,3}\s+${UNIT}\b`,
    String.raw`\b(?:a\s+)?cada\s+${COUNT}\s*${UNIT}\b|\bevery\s+${COUNT}\s*${UNIT}\b|\bevery\s+(?:other|second|third)\s+(?:${WEEKDAY_RE})\b`,
    String.raw`\b(?:quinzenal(?:mente)?|bi\s*(?:weekly|monthly)|fortnightly|(?:bi|tri)mestralmente|semestralmente)\b`,
    String.raw`\bdia\s+sim,?\s+dia\s+nao\b|\bdias\s+alternados\b|\b(?:nos\s+)?dias\s+(?:pares|impares)\b|\b(?:on\s+)?(?:even|odd)\s+days\b`,
    String.raw`\b(?:\d|${HOUR_WORD_RE})\s*(?:x|vezes)\s+(?:por|ao|na)\s+(?:dia|semana|mes|ano)\b|\b(?:twice|\w+\s+times|\d\s*x)\s+(?:a|per)\s+(?:day|week|month|year)\b`,
    String.raw`\b(?:${ORDINAL_WORD})\s+(?:${WEEKDAY_RE}|semana|week|dia\s+util|weekday)(?:\s*feira)?\s+(?:d[oe]|of)\s+(?:cada\s+|every\s+|each\s+|the\s+)?(?:mes|month)\b`,
    String.raw`\bsemanas\s+alternadas\b|\balternate\s+weeks\b|\b(?:exceto|menos|fora|except|but)\s+(?:(?:os|no|nos|on|o)\s+)?(?:feriados?|holidays?|dia\s+\d|the\s+\d)`,
  ].join("|"),
);
// Série com fim (todo dia por 7 dias · every monday until december): o `Repeat` não tem fim.
export const BOUNDED_REPEAT_RE = new RegExp(
  `\\b(?:por|durante|for)\\s+${COUNT}\\s+(?:dias|semanas|meses|days|weeks|months)\\b|\\b(?:ate|until|till)\\s+(?:${MONTH_RE})\\b`,
);
