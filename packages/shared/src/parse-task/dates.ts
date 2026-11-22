import { type Hit, type Span, hit, spanOf } from "./spans";
import {
  AMOUNT_RE,
  HOUR_WORDS,
  HOUR_WORD_RE,
  MONTHS,
  MONTH_RE,
  NEXT_RE,
  WEEKDAYS,
  WEEKDAY_RE,
  addDays,
  addMonths,
  alternation,
  amountOf,
  dateIn,
  nextWeekday,
  startOfDay,
} from "./vocab";

/** A próxima data com esse dia a partir de hoje, andando `step` meses: 12 pra data sem ano
 * ("10 de fevereiro" em novembro é o do ano que vem; 29/02 espera o bissexto), 1 pra "dia 31". */
function upcoming(now: Date, month: number, day: number, step: 1 | 12): Date | null {
  for (let i = 0; i < 12; i++) {
    const date = dateIn(now, now.getFullYear(), month + i * step, day);
    if (date.getDate() === day && date >= startOfDay(now)) return date;
  }
  return null;
}

/** Dia/mês com ano explícito vale como está; sem ano, é a próxima ocorrência. */
export function dated(now: Date, month: number, day: number, rawYear?: string): Date | null {
  if (month < 0 || month > 11) return null;
  if (!rawYear) return upcoming(now, month, day, 12);
  const year = Number(rawYear) < 100 ? 2000 + Number(rawYear) : Number(rawYear);
  const date = dateIn(now, year, month, day);
  return date.getDate() === day && date.getMonth() === month ? date : null;
}

// "26-11", "03-12", "17.11": day-month written with a dash or a dot. A dash is an hour range unless
// the day can't be an hour of one ("26") or is zero-padded; a dot is a clock unless the month can't
// pass for round minutes ("17.10" stays 17:10). After "às" both are the clock.
const SEPARATED_DATE_RE =
  /(?<!(?:\b(?:as|a|at|pelas|das|de|from|entre|ate|versao|version|v)|r\$|\$|@)\s*)(?<![\d/.:,-])\b(\d{1,2})([-.])(\d{2})\b(?![-/.:,]?\d|\s*h\b)/g;

/** `text` (normalized) with those separators turned into "/", same length, for the `15/08` reader. */
export function slashDates(input: string, text: string): string {
  const out = text.split("");
  // The normalize turned the dash into a space; put it back to read the shape.
  const probe = out.map((char, i) => (input[i] === "-" ? "-" : char)).join("");
  for (const found of probe.matchAll(SEPARATED_DATE_RE)) {
    const [, rawDay, sep, rawMonth] = found;
    const [day, month] = [Number(rawDay), Number(rawMonth)];
    const date =
      day >= 1 &&
      day <= 31 &&
      month >= 1 &&
      month <= 12 &&
      (sep === "-" ? day > 12 || rawDay.startsWith("0") : month % 5 !== 0);
    if (date) out[(found.index ?? 0) + rawDay.length] = "/";
  }
  return out.join("");
}

const ORDINAL = "(?:st|nd|rd|th)\\b";
const dayNumber = (raw: string) =>
  raw === "primeiro" ? 1 : (HOUR_WORDS[raw.replace(/\s+/g, " ")] ?? Number(raw));

const YEAR_SUFFIX = "(?:,?\\s+(?:de\\s+)?(\\d{4})\\b)?";
// "out 15"/"set 15"/"Marco 15" é "check out 15 recipes" e "ligar pro Marco 15h" — em pt o mês vem
// depois do dia, então essas três só valem na ordem dia-mês.
export const MONTH_FIRST_RE = alternation(
  Object.keys(MONTHS).filter((key) => !["out", "set", "marco"].includes(key)),
);

const WEEKDAY_MATCH_RE = new RegExp(
  `\\b(${WEEKDAY_RE})(?:(?<!sabado|domingo)\\s*feira)?\\b\\.?(?!\\s+(?:via|chamada|vez|opcao|mao)\\b)`,
  "g",
);
// Abreviação que também é palavra ("ter aula", "sex education", "sun cream", "buy wed dress") só
// conta perto de uma preposição, de uma hora ou no fim da frase.
const AMBIGUOUS_WEEKDAYS = ["ter", "tera", "sex", "dom", "seg", "sun", "wed", "sat"];
const DAY_BEFORE_RE =
  /\b(?:na|no|nesta|neste|nessa|nesse|essa|esse|esta|este|ate|proxim[ao]|prox|toda|todo|on|by|this|next|every|each|until|before)\s+$/;
export const DAY_AFTER_RE =
  /^(?:\s*feira|\s*$|\s*[,.]|\s+\d|\s+(?:as|at|am|pm|(?:que|q)\s+vem|de\s+(?:manha|tarde|noite)|morning|afternoon|evening|night|noon|meio\s*dia)\b)/;
// "ter levar o dog", "sex entregar relatório": abrindo a frase antes de um verbo no infinitivo.
const DAY_THEN_VERB_RE = /^\s+[a-z]{2,}(?:ar|er|ir)\b/;

function weekdayInContext(text: string, match: RegExpMatchArray): boolean {
  if (!AMBIGUOUS_WEEKDAYS.includes(match[1]) || /feira/.test(match[0])) return true;
  const [start, end] = spanOf(match);
  const after = text.slice(end);
  return (
    DAY_BEFORE_RE.test(text.slice(0, start)) ||
    DAY_AFTER_RE.test(after) ||
    (!text.slice(0, start).trim() && DAY_THEN_VERB_RE.test(after))
  );
}

// "segunda, 23 de novembro" / "4 de dezembro, sexta": o dia da semana colado na data só a confirma.
// One that contradicts it ("segunda dia 18", a Wednesday) stays in the title for `unsure` to see.
function withWeekday(text: string, match: RegExpMatchArray, date: Date): Hit<Date> {
  const [start, end] = spanOf(match);
  const spans: Span[] = [[start, end]];
  const names = (found: RegExpMatchArray | null) => found && WEEKDAYS[found[1]] === date.getDay();
  const before = text.slice(0, start).match(new RegExp(`\\b(${WEEKDAY_RE})(?:\\s*feira)?[\\s,]*$`));
  if (before && names(before)) spans.push([before.index ?? 0, start]);
  const after = text.slice(end).match(new RegExp(`^[\\s,]*(${WEEKDAY_RE})(?:\\s*feira)?\\b`));
  if (after && names(after)) spans.push([end, end + after[0].length]);
  return { value: date, spans };
}

/** `weekday`: veio de um dia da semana, que pula uma semana se hoje já passou da hora. */
export function parseDay(text: string, now: Date): (Hit<Date> & { weekday?: boolean }) | null {
  const today = text.match(
    /\b(?:ainda\s+|later\s+)?(?<!\bfrom\s+)(?:hoje|hj|today|2day)(?:\s+(?:mesmo|ainda))?\b|\b(?:daqui\s+a\s+pouco|in\s+a\s+bit)\b/,
  );
  if (today) return hit(today, startOfDay(now));

  const TOMORROW = "amanha+|amn|amnh|amanah|amaha|tomorrow|tmrw?|2moro|tomm?orr?ow";
  const dayAfterTomorrow = text.match(
    new RegExp(`\\b((?:depois|dps)\\s+d[eo]?\\s+(?:${TOMORROW})|day\\s+after\\s+tomorrow)\\b`),
  );
  if (dayAfterTomorrow) return hit(dayAfterTomorrow, addDays(now, 2));

  const tomorrow = text.match(
    new RegExp(`\\b(?:${TOMORROW}|dia\\s+seguinte)\\b(?:\\s+sem\\s+falta\\b)?`),
  );
  if (tomorrow) return hit(tomorrow, addDays(now, 1));

  const dayBeforeYesterday = text.match(/\b(anteontem|day\s+before\s+yesterday)\b/);
  if (dayBeforeYesterday) return hit(dayBeforeYesterday, addDays(now, -2));

  const yesterday = text.match(/\b(ontem|yesterday)\b/);
  if (yesterday) return hit(yesterday, addDays(now, -1));

  const tonight = text.match(
    /\bton(?:ight|ite)\b|\b2ni(?:gh)?te\b|\b(?:esta|essa|nesta|nessa)\s+(?:noite|manha|tarde)\b|\bthis\s+(?:morning|afternoon|evening)\b/,
  );
  if (tonight) return hit(tonight, startOfDay(now));

  // daqui a 3 dias · in 2 weeks · em uma semana · daqui a 2 meses · 3 days from now
  const relative =
    text.match(
      new RegExp(
        `\\b(?:daqui(?:\\s+a)?|em|in|dentro\\s+de|within)\\s+(${AMOUNT_RE})\\s*(dias?|days?|semanas?|weeks?|mes(?:es)?|months?|anos?|years?)\\b`,
      ),
    ) ??
    text.match(
      new RegExp(`\\b(${AMOUNT_RE})\\s+(days?|weeks?|months?)\\s+from\\s+(?:now|today)\\b`),
    );
  if (relative) {
    const amount = amountOf(relative[1]);
    const unit = relative[2];
    if (/^(?:mes|month)/.test(unit)) return hit(relative, addMonths(now, amount));
    if (/^(?:ano|year)/.test(unit)) return hit(relative, addMonths(now, amount * 12));
    return hit(relative, addDays(now, /^(?:semana|week)/.test(unit) ? amount * 7 : amount));
  }

  // mês que vem · next year · semana passada
  const nextPeriod = text.match(
    /\b(?:(?:n?o\s+)?(?:proximo|prox)\s+(mes|ano)|(mes|ano)\s+(?:que|q)\s+vem|next\s+(month|year))\b/,
  );
  if (nextPeriod) {
    const unit = nextPeriod.slice(1).find(Boolean);
    return hit(nextPeriod, addMonths(now, unit === "mes" || unit === "month" ? 1 : 12));
  }
  const lastWeek = text.match(/\b(?:(?:n?a\s+)?semana\s+passada|last\s+week)\b/);
  if (lastWeek) return hit(lastWeek, addDays(now, -7));

  // fim de semana · this weekend · fim do mês · end of week · começo do mês
  const weekend = text.match(
    /\b(?:(?:n?o|neste|nesse|este|esse|this|over\s+the|on\s+the)\s+)?(?:(?:fim|final)\s+de\s+semana|fds|weekend)\b/,
  );
  if (weekend) return hit(weekend, nextWeekday(now, 6));
  const monthEnd = text.match(
    /\b(?:(?:n?o|at\s+the|by)\s+)?(?:(?:fim|final)\s+d[oe]\s+mes|end\s+of\s+(?:the\s+)?month|eom)\b/,
  );
  if (monthEnd) return hit(monthEnd, dateIn(now, now.getFullYear(), now.getMonth() + 1, 0));
  const weekEnd = text.match(
    /\b(?:(?:n?o|at\s+the|by)\s+)?(?:(?:fim|final)\s+da\s+semana|end\s+of\s+(?:the\s+)?week|eow)\b/,
  );
  if (weekEnd) return hit(weekEnd, nextWeekday(now, 5));
  const monthStart = text.match(
    /\b(?:n?o\s+)?(?:comeco|inicio)\s+d[oe]\s+mes\b|\b(?:at\s+the\s+)?(?:start|beginning)\s+of\s+(?:the\s+)?month\b/,
  );
  if (monthStart) {
    const first =
      now.getDate() === 1 ? startOfDay(now) : dateIn(now, now.getFullYear(), now.getMonth() + 1, 1);
    return hit(monthStart, first);
  }

  // de 13 a 15 de dezembro · Dec 13-15: vale o primeiro dia
  const dayRange =
    text.match(
      new RegExp(
        `\\b(?:de\\s+|from\\s+)?(\\d{1,2})\\s+(?:a|ate|to)\\s+\\d{1,2}\\s+(?:de\\s+)?(${MONTH_RE})\\b`,
      ),
    ) ??
    text.match(
      new RegExp(
        `\\b(?:from\\s+)?(${MONTH_FIRST_RE})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?: | (?:to|through) )\\d{1,2}(?:st|nd|rd|th)?\\b(?!\\s*(?:[:h]|[ap]\\.?m\\b))`,
      ),
    );
  if (dayRange) {
    const [day, month] = /^\d/.test(dayRange[1])
      ? [Number(dayRange[1]), MONTHS[dayRange[2]]]
      : [Number(dayRange[2]), MONTHS[dayRange[1]]];
    const date = upcoming(now, month, day, 12);
    if (date) return hit(dayRange, date);
  }

  // 2026-11-23 · 01-12-2026 (o traço virou espaço no normalize)
  const iso = text.match(/\b(20\d{2}) (\d{1,2}) (\d{1,2})\b/);
  if (iso) {
    const date = dated(now, Number(iso[2]) - 1, Number(iso[3]), iso[1]);
    if (date) return hit(iso, date);
  }
  const dashed = text.match(
    /\b(\d{1,2}) (\d{1,2}) (20\d{2})\b|\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/,
  );
  if (dashed) {
    const [day, month, year] = (dashed[1] ? dashed.slice(1, 4) : dashed.slice(4, 7)).map(String);
    const date = dated(now, Number(month) - 1, Number(day), year);
    if (date) return hit(dashed, date);
  }

  // 15/08 · 15/08/2026 · 15/8 — "24/7" é "o tempo todo", não 24 de julho
  const numeric = text.match(/\b(?!24\/7\b)(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (numeric) {
    // 11/23 só pode ser mês/dia (o americano).
    const [day, month] =
      Number(numeric[2]) > 12 && Number(numeric[1]) <= 12
        ? [Number(numeric[2]), Number(numeric[1]) - 1]
        : [Number(numeric[1]), Number(numeric[2]) - 1];
    const date = dated(now, month, day, numeric[3]);
    if (date) return withWeekday(text, numeric, date);
  }

  // 15 de agosto · 15 ago · 1º de dezembro de 2026 · august 15 · Nov. 23, 2026 · 3rd of December
  // · primeiro de janeiro · três de dezembro
  const dayFirst = text.match(
    new RegExp(
      `\\b(\\d{1,2}|primeiro|${HOUR_WORD_RE})(?:[ºª]|o\\b|${ORDINAL})?\\s+(?:de\\s+|of\\s+)?(${MONTH_RE})\\b\\.?${YEAR_SUFFIX}`,
    ),
  );
  const monthFirst = text.match(
    new RegExp(`\\b(${MONTH_FIRST_RE})\\b\\.?\\s+(\\d{1,2})(?:${ORDINAL})?\\b${YEAR_SUFFIX}`),
  );
  const named = dayFirst
    ? { match: dayFirst, day: dayNumber(dayFirst[1]), month: MONTHS[dayFirst[2]] }
    : monthFirst
      ? { match: monthFirst, day: Number(monthFirst[2]), month: MONTHS[monthFirst[1]] }
      : null;
  if (named) {
    const date = dated(now, named.month, named.day, named.match[3]);
    if (date) return withWeekday(text, named.match, date);
  }

  // dia 15 — este mês se ainda não passou, senão o próximo mês que tem esse dia ("dia 31" em
  // novembro é 31/12). Vem antes do dia da semana: "segunda dia 23" é o dia 23.
  // · dia primeiro · on the 23rd · every 20th
  const monthDay = text.match(
    new RegExp(
      `\\b(?:(?:dia|day)\\s+(\\d{1,2}|primeiro)(?:[ºª]|\\b)|\\bthe\\s+(\\d{1,2})${ORDINAL}|\\b(\\d{1,2})${ORDINAL}(?=\\s*$|\\s*[,.;!]|\\s+(?:of|do|at|as|@|\\d)))(?:\\s+(?:do\\s+mes|of\\s+the\\s+month)\\b)?`,
    ),
  );
  if (monthDay) {
    const date = upcoming(
      now,
      now.getMonth(),
      dayNumber(monthDay[1] ?? monthDay[2] ?? monthDay[3]),
      1,
    );
    return date ? withWeekday(text, monthDay, date) : null;
  }

  // segunda · terça-feira · next friday · 2ª · 6a feira — a próxima ocorrência; hoje passado pula
  // uma semana no parseWhen
  const ordinal = text.match(/\b([2-6])(?:ª(?:\s*feira\b)?|a\s*feira\b)/);
  const weekdays = [
    ...(ordinal ? [{ match: ordinal, target: Number(ordinal[1]) - 1 }] : []),
    ...[...text.matchAll(WEEKDAY_MATCH_RE)]
      .filter((weekday) => weekdayInContext(text, weekday))
      .map((weekday) => ({ match: weekday, target: WEEKDAYS[weekday[1]] })),
  ];
  for (const { match: weekday, target } of weekdays) {
    const [start, end] = spanOf(weekday);
    const delta = (target - now.getDay() + 7) % 7;
    const extra: Span[] = [];
    // Pista colada antes (`$`) ou depois (`^`) do dia da semana, que sai do título junto.
    const before = (re: RegExp) => {
      const found = text.slice(0, start).match(re);
      if (found) extra.push([found.index ?? 0, start]);
      return found !== null;
    };
    const after = (re: RegExp) => {
      const found = text.slice(end).match(re);
      if (found) extra.push([end, end + found[0].length]);
      return found !== null;
    };
    // "sexta passada", "last friday": a ocorrência anterior.
    if (after(/^\s+passad[ao]\b/) || before(/\blast\s+$/)) {
      return hit(weekday, addDays(now, delta ? delta - 7 : -7), extra);
    }
    const weekFrom = before(/\b(?:a|one)\s+week\s+from\s+$/);
    after(/^\s+(?:da|dessa|desta|nesta|nessa)\s+(?:proxima\s+)?semana(?:\s+(?:que|q)\s+vem)?\b/);
    before(/\b(?:no\s+maximo\s+ate|no\s+later\s+than)\s+$/);
    // "semana que vem na segunda": a semana vem antes do dia.
    before(/\b(?:(?:n?a\s+)?semana\s+(?:que|q)\s+vem|next\s+week)\s+(?:n[ao]\s+|on\s+)?$/);
    // "próxima terça" pula pra semana seguinte; "terça" seca é a mais próxima — mas o span
    // sempre inclui a pista de "próxima"/"que vem" quando ela apareceu, senão sobra no título.
    const next = text.match(NEXT_RE);
    if (next) extra.push(spanOf(next));
    const date = addDays(now, next || weekFrom ? delta + 7 : delta);
    return { ...hit(weekday, date, extra), weekday: true };
  }

  // até o natal · before christmas (a véspera)
  const christmas = text.match(/\b(?:ate\s+o|no|by|until|on|(before))\s+(?:natal|christmas)\b/);
  if (christmas) {
    const date = upcoming(now, 11, christmas[1] ? 24 : 25, 12);
    if (date) return hit(christmas, date);
  }

  // semana que vem · next week, sem dia da semana junto
  const nextWord = text.match(NEXT_RE);
  const weekWord = text.match(/\b(semana|week|wk)\b/);

  if (nextWord && weekWord) return hit(nextWord, addDays(now, 7), [spanOf(weekWord)]);

  return null;
}
