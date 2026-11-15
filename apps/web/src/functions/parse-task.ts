import { weekDays, type Repeat } from "@dailify/shared";
import { parseLinks } from "./parse-links";
import { zoned, zonedAt } from "./zone";

/**
 * `parseTaskText` é a porta de entrada: recebe a frase inteira do composer ("reunião com o time
 * das 15 às 16 meet.google.com/abc") e devolve título, data, duração e links — sem LLM:
 * normalização + tabelas + regex. Cada detector (link, duração, dia, hora) procura o seu pedaço
 * independentemente dos outros, então pt-BR e inglês podem vir misturados na mesma frase, e o que
 * cada um consumiu é recortado do título pelos spans que devolve.
 *
 * `parseWhen`/`parseDuration` são os detectores por baixo, exportados pro teste. `parseWhen`
 * devolve `null` quando não reconhece nada e `hasTime: false` quando só achou o dia, pra quem
 * chama decidir o horário padrão.
 */

export interface ParsedWhen {
  date: Date;
  hasDay: boolean;
  hasTime: boolean;
  spans: Span[];
}

export type Span = [number, number];

/** Valor + os trechos do texto que o produziram. `spans` vazio = veio de lugar nenhum. */
interface Hit<T> {
  value: T;
  spans: Span[];
}

/** O span de um `String.match`. */
function spanOf(match: RegExpMatchArray): Span {
  const start = match.index ?? 0;
  return [start, start + match[0].length];
}

/** Embrulha o resultado de um `String.match` com o span dele. */
function hit<T>(match: RegExpMatchArray, value: T, extra: Span[] = []): Hit<T> {
  return { value, spans: [spanOf(match), ...extra] };
}

/**
 * Une spans que se sobrepõem ou se encostam — "at 9" e "9 pm" batem em detectores diferentes e
 * dividem o "9"; escolher um deixaria o pedaço exclusivo do outro ("pm") no título.
 * A saída **disjunta e ordenada** é contrato: `cut()` anda `pos` só pra frente e duplicaria texto
 * com spans sobrepostos.
 */
function mergeSpans(spans: Span[]): Span[] {
  const merged: Span[] = [];
  for (const [start, end] of [...spans].sort((a, b) => a[0] - b[0])) {
    const last = merged.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

/** Horas assumidas quando o texto dá só o período ("amanhã de manhã", "tonight"). */
const PERIOD_HOURS = { morning: 9, afternoon: 14, evening: 20, dawn: 6 } as const;

const HOUR_WORDS: Record<string, number> = {
  uma: 1,
  um: 1,
  one: 1,
  duas: 2,
  dois: 2,
  two: 2,
  tres: 3,
  three: 3,
  quatro: 4,
  four: 4,
  cinco: 5,
  five: 5,
  seis: 6,
  six: 6,
  sete: 7,
  seven: 7,
  oito: 8,
  eight: 8,
  nove: 9,
  nine: 9,
  dez: 10,
  ten: 10,
  onze: 11,
  eleven: 11,
  doze: 12,
  twelve: 12,
  treze: 13,
  quatorze: 14,
  catorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20,
  "vinte e uma": 21,
  "vinte e um": 21,
  "vinte e duas": 22,
  "vinte e dois": 22,
  "vinte e tres": 23,
  "vinte e quatro": 24,
};

const MINUTE_WORDS: Record<string, number> = {
  meia: 30,
  half: 30,
  quinze: 15,
  quarter: 15,
  trinta: 30,
  thirty: 30,
  dez: 10,
  ten: 10,
  vinte: 20,
  twenty: 20,
  cinco: 5,
  five: 5,
  quarenta: 40,
  forty: 40,
  cinquenta: 50,
  fifty: 50,
  "quarenta e cinco": 45,
  "forty five": 45,
  "vinte e cinco": 25,
  "trinta e cinco": 35,
};

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
  dom: 0,
  seg: 1,
  ter: 2,
  qua: 3,
  qui: 4,
  sex: 5,
  sab: 6,
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sun: 0,
  mon: 1,
  tue: 2,
  tues: 2,
  wed: 3,
  thu: 4,
  thur: 4,
  thurs: 4,
  fri: 5,
  sat: 6,
  sabdo: 6,
  wensday: 3,
  thrusday: 4,
};

const MONTHS: Record<string, number> = {
  janeiro: 0,
  fevereiro: 1,
  marco: 2,
  abril: 3,
  maio: 4,
  junho: 5,
  julho: 6,
  agosto: 7,
  setembro: 8,
  outubro: 9,
  novembro: 10,
  dezembro: 11,
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
  jan: 0,
  fev: 1,
  feb: 1,
  mar: 2,
  abr: 3,
  apr: 3,
  mai: 4,
  jun: 5,
  jul: 6,
  ago: 7,
  aug: 7,
  set: 8,
  sep: 8,
  sept: 8,
  out: 9,
  oct: 9,
  nov: 10,
  dez: 11,
  dec: 11,
};

/**
 * minúsculas, sem acento, hífens e apóstrofos viram espaço — **1 char entra, 1 char sai**.
 * O comprimento é contrato: os detectores medem spans no texto normalizado e o recorte acontece
 * no original. Colapsar espaço ou dar trim aqui desalinharia os dois.
 */
export function normalize(input: string): string {
  return input
    .split("")
    .map((char) => {
      // toLowerCase() na string inteira expandiria "İ" pra 2 chars antes do guard entrar em
      // jogo; lowercasing por char mantém o guard abaixo como única porta de saída.
      const lower = char.toLowerCase();
      const stripped = lower.normalize("NFD").replace(/[̀-ͯ]/g, "");
      // "ﬁ" e afins podem expandir em NFD/lowercase; só aceita a troca quando volta a 1 char.
      const base = stripped.length === 1 ? stripped : char;
      return /[-–—'’]/.test(base) ? " " : base;
    })
    .join("");
}

const startOfDay = (d: Date) => zonedAt(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => zonedAt(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** "31/01 + 1 mês" é 28/02, não 03/03. */
const addMonths = (d: Date, n: number) =>
  zonedAt(
    d.getFullYear(),
    d.getMonth() + n,
    Math.min(d.getDate(), zonedAt(d.getFullYear(), d.getMonth() + n + 1, 0).getDate()),
  );
/** A próxima ocorrência do dia da semana `target`, hoje incluso. */
const nextWeekday = (now: Date, target: number) => addDays(now, (target - now.getDay() + 7) % 7);

/** Vira alternativa de regex com as chaves mais longas primeiro — senão "vinte" come "vinte e uma". */
const alternation = (keys: string[]) =>
  [...keys]
    .sort((a, b) => b.length - a.length)
    .join("|")
    .replace(/ /g, "\\s+");

const HOUR_WORD_RE = alternation(Object.keys(HOUR_WORDS));
const MINUTE_WORD_RE = alternation(Object.keys(MINUTE_WORDS));
const WEEKDAY_RE = alternation(Object.keys(WEEKDAYS));
const MONTH_RE = alternation(Object.keys(MONTHS));

const NEXT_RE = /\b(?:proxim[ao]|prox|(?:que|q)\s+vem|next|nxt)\b\.?/;

// Quantidade de "daqui a uma semana", "in an hour", "em três dias".
const AMOUNT_RE = `\\d{1,3}|an|a|${HOUR_WORD_RE}`;

const MINUTE_SUFFIX_RE = `(?:\\s+(?:e|and)\\s+(${MINUTE_WORD_RE}|\\d{1,2}))?`;

// "às"/"at" logo antes da hora: sem isso no span, "hoje às 16:30" recorta só "16:30" e deixa "às" no título.
// "por volta das", "lá pelas", "around" são o mesmo conector, com a hora igual.
const AT_RE =
  "(?:\\b(?:as|at|por\\s+volta\\s+d[ae]s?|la\\s+pel[ao]s|pel[ao]s|around|about)\\s+|@\\s*)";
const CONNECTOR_RE = `${AT_RE}?`;
// "7a"/"3p" só no fim ou antes do dia: "2a via" e "3a parcela" são ordinais.
const SHORT_MERIDIEM_END = String.raw`\s*$|\s*[,.;!]|\s+(?:tomorrow|today|tmrw?|on|every)\b`;

/** Os minutos de um "… e meia" / "… e 15"; 0 quando o sufixo não veio. */
function suffixMinutes(raw: string | undefined): number {
  if (!raw) return 0;
  const value = raw.replace(/\s+/g, " ");
  const minutes = /^\d+$/.test(value) ? Number(value) : MINUTE_WORDS[value];
  return minutes !== undefined && minutes < 60 ? minutes : 0;
}

interface Time {
  hour: number;
  minute: number;
  /** Dias à frente de hoje — só a hora relativa ("em 24 horas") sabe isso sozinha. */
  days?: number;
}

/** Qual dia o texto deu: hoje explícito, nenhum (a hora decide, e pode rolar pra amanhã) ou outro. */
type Base = "today" | "none" | "other";

/**
 * Resolve o período quando o texto não diz manhã/tarde/noite. Só a hora **seca** ("às 9", "at 6",
 * "às duas") é ambígua — relógio ("9h", "10:30") e recorrência são literais (Dailify-9g0):
 *
 * - **Hoje/sem dia**: vale a próxima ocorrência. São 14h e o usuário pede "às 3"? 15h, não 3h da
 *   manhã. Pede "às 9"? 21h. Se as duas já passaram, "hoje" fica com a mais recente (o usuário
 *   disse hoje); sem dia cai na regra de outro dia e o `parseWhen` rola pra amanhã.
 * - **Outro dia**: leitura literal, que é o que "amanhã às 9" quer dizer (9h da manhã) — exceto
 *   1h–7h, que viram tarde/noite, porque tarefa de madrugada é rara.
 */
function applyMeridiem(
  time: Time,
  text: string,
  now: Date,
  base: Base,
  literal = false,
): Hit<Time> {
  const pm = text.match(
    new RegExp(
      String.raw`\b(da|de|a|na|pela|at|in|this)\s+(?:the\s+)?(tarde|noite|afternoon|evening|night)\b|\d\s*p\.?m\b\.?|\bp\.?m\b\.?|\dp(?=${SHORT_MERIDIEM_END})|\bton(?:ight|ite)\b`,
    ),
  );
  const am = text.match(
    new RegExp(
      String.raw`\b(da|de|a|na|pela|at|in|this)\s+(?:the\s+)?(manha|madrugada|morning|dawn)\b|\d\s*a\.?m\b\.?|\ba\.?m\b\.?|\da(?=${SHORT_MERIDIEM_END})`,
    ),
  );
  const period = periodHour(text);

  const isPM = pm !== null;
  const isAM = am !== null;

  let { hour } = time;
  const { minute } = time;

  if (isPM) {
    if (hour < 12) hour += 12;
  } else if (isAM) {
    if (hour === 12) hour = 0;
  } else if (!literal && hour >= 1 && hour <= 12) {
    const alternative = hour === 12 ? 0 : hour + 12;
    const minutesNow = now.getHours() * 60 + now.getMinutes();
    const asIs = hour * 60 + minute;
    const alt = alternative * 60 + minute;
    const asIsAhead = asIs > minutesNow;
    const altAhead = alt > minutesNow;

    if (base !== "other" && (asIsAhead || altAhead)) {
      hour = asIsAhead && (!altAhead || asIs <= alt) ? hour : alternative;
    } else if (base === "today") {
      hour = asIs >= alt ? hour : alternative;
    } else if (hour <= 7) {
      hour = alternative;
    }
  }

  // A regra de conversão em si não muda — só passa a carregar de onde a pista veio.
  const spans: Span[] = [];
  if (pm) spans.push(spanOf(pm));
  if (am) spans.push(spanOf(am));
  if (period) spans.push(...period.spans);

  return { value: { hour: hour === 24 ? 0 : hour, minute }, spans };
}

function periodHour(text: string): Hit<number> | null {
  const patterns: [RegExp, number][] = [
    // Os específicos antes: "no fim da tarde" também casaria "da tarde".
    [/\b(?:n?o\s+)?(?:fim|final)\s+da\s+tarde\b|\blate\s+afternoon\b/, 18],
    [/\b(?:[ao]\s+|de\s+)?(?:tardinha|tardezinha)\b/, 17],
    [/\b(?:n?o\s+)?(?:inicio|comeco)\s+da\s+manha\b|\bearly\s+morning\b/, 7],
    [/\b(?:depois|dps|apos)\s+do\s+almoco\b|\bafter\s+lunch\b/, 13],
    [
      /\b(?:n?a\s+)?hora\s+do\s+almoco\b|\bno\s+almoco\b|\b(?:at\s+)?lunchtime\b|\bat\s+lunch\b/,
      12,
    ],
    [/\b(?:at\s+(?:the\s+)?)?end\s+of\s+(?:the\s+)?day\b|\beod\b/, 18],
    // "amanhã cedo" — "dormir cedo" é título.
    [/\bcedinho\b|\bearly(?=\s+tomorrow\b)/, 7],
    [/(?<=\b(?:amanha|hoje)\s+)cedo\b/, 8],
    [new RegExp(`(?<=\\b(?:tomorrow|today|${WEEKDAY_RE})\\s+)night\\b`), PERIOD_HOURS.evening],
    [
      /\b(ton(?:ight|ite)|(?:esta|essa|nesta|nessa)\s+noite|a\s+noite|da\s+noite|de\s+noite|(?:this\s+|in\s+the\s+)?evening|at\s+night)\b/,
      PERIOD_HOURS.evening,
    ],
    [
      /\b(de\s+manha|da\s+manha|pela\s+manha|(?:this\s+|in\s+the\s+)?morning)\b/,
      PERIOD_HOURS.morning,
    ],
    [
      /\b(a\s+tarde|de\s+tarde|da\s+tarde|(?:this\s+|in\s+the\s+)?afternoon)\b/,
      PERIOD_HOURS.afternoon,
    ],
    [/\b(de\s+madrugada|da\s+madrugada|dawn)\b/, PERIOD_HOURS.dawn],
  ];
  for (const [re, hour] of patterns) {
    const match = text.match(re);
    if (match) return hit(match, hour);
  }
  return null;
}

function parseTime(text: string, now: Date, base: Base, literalTime = false): Hit<Time> | null {
  // daqui a 2 horas · in 90 minutes · em meia hora · daqui a 1h30 · in an hour and a half — `days`
  // porque "em 24 horas" cai amanhã na mesma hora
  const relative = text.match(
    new RegExp(
      `\\b(?:daqui(?:\\s+a)?|em|in|dentro\\s+de|within)\\s+(?:(meia\\s+hora|half\\s+an?\\s+hour)|(${AMOUNT_RE})\\s*(h|hs|hrs?|horas?|hours?|min|mins|minutos?|minutes?)(?![a-z])(?:(\\d{2})(?!\\d)|\\s+(?:e|and)\\s+(?:(meia|a\\s+half)|(\\d{1,2}|${MINUTE_WORD_RE})\\s*${MINUTE_UNIT})\\b)?)`,
    ),
  );
  if (relative) {
    const [, half, rawAmount, unit, clockMinutes, andHalf, rawMinutes] = relative;
    const minutes = half
      ? 30
      : /^min/.test(unit)
        ? amountOf(rawAmount)
        : amountOf(rawAmount) * 60 +
          (andHalf ? 30 : clockMinutes ? Number(clockMinutes) : suffixMinutes(rawMinutes));
    const target = zoned(now.getTime() + minutes * 60_000);
    const days = Math.round(
      (startOfDay(target).getTime() - startOfDay(now).getTime()) / 86_400_000,
    );
    return hit(relative, { hour: target.getHours(), minute: target.getMinutes(), days });
  }

  // quinze para as 10 · 10 pras 3 da tarde · cinco para o meio-dia
  const before = text.match(
    new RegExp(
      `${CONNECTOR_RE}\\b(${MINUTE_WORD_RE}|\\d{1,2})\\s+(?:para\\s+(?:as|a|o)|pras|pra\\s+as|pro)\\s+(${HOUR_WORD_RE}|\\d{1,2}|meio\\s*dia)\\b`,
    ),
  );
  if (before) {
    const offset = suffixMinutes(before[1]);
    const rawHour = before[2].replace(/\s+/g, " ");
    const hour = rawHour === "meio dia" ? 12 : (HOUR_WORDS[rawHour] ?? Number(rawHour));
    if (offset > 0 && hour >= 1 && hour <= 24) {
      const meridiem = applyMeridiem(
        { hour: hour - 1, minute: 60 - offset },
        text,
        now,
        base,
        literalTime || rawHour === "meio dia",
      );
      return hit(before, meridiem.value, meridiem.spans);
    }
  }

  // "meio dia e meia" é 12:30 — o sufixo tem que entrar aqui, senão o atalho engole os minutos.
  const noon = text.match(
    new RegExp(`${CONNECTOR_RE}\\b(?:meio\\s*dia|noon|midday)\\b${MINUTE_SUFFIX_RE}`),
  );
  if (noon) return hit(noon, { hour: 12, minute: suffixMinutes(noon[1]) });

  const midnight = text.match(
    new RegExp(`${CONNECTOR_RE}\\b(?:meia\\s*noite|midnight)\\b${MINUTE_SUFFIX_RE}`),
  );
  if (midnight) return hit(midnight, { hour: 0, minute: suffixMinutes(midnight[1]) });

  // 14:30 · 14h30 · 14.30 · 14,30 · 9h45min · 10:00h — "3:30pm" não tem \b entre o 0 e o p.
  // Dinheiro e versão ("R$ 12,50", "versão 2.10") têm a mesma cara e não são hora.
  const withMinutes = text.match(
    new RegExp(
      `(?<!(?:[$€£]|r\\$|versao|version)\\s*)${CONNECTOR_RE}\\b(\\d{1,2})\\s*[:h.,]\\s*(\\d{2})(?!\\d|[./]\\d)(?:\\s*min\\b|h\\b)?`,
    ),
  );
  if (withMinutes) {
    const hour = Number(withMinutes[1]);
    const minute = Number(withMinutes[2]);
    if (hour <= 24 && minute < 60) {
      const meridiem = applyMeridiem({ hour, minute }, text, now, base, true);
      return hit(withMinutes, meridiem.value, meridiem.spans);
    }
  }

  // 14 e 30 · 2 e meia
  const withSpelledMinutes = text.match(
    new RegExp(`${CONNECTOR_RE}\\b(\\d{1,2})\\s+e\\s+(\\d{1,2}|${MINUTE_WORD_RE})\\b`),
  );
  if (withSpelledMinutes) {
    const hour = Number(withSpelledMinutes[1]);
    const raw = withSpelledMinutes[2].replace(/\s+/g, " ");
    const minute = /^\d+$/.test(raw) ? Number(raw) : MINUTE_WORDS[raw];
    if (hour <= 24 && minute !== undefined && minute < 60) {
      const meridiem = applyMeridiem({ hour, minute }, text, now, base, literalTime);
      return hit(withSpelledMinutes, meridiem.value, meridiem.spans);
    }
  }

  // half past two · quarter past two · quarter to three
  const past = text.match(
    new RegExp(
      `${CONNECTOR_RE}\\b(${MINUTE_WORD_RE})\\s+(past|to)\\s+(${HOUR_WORD_RE}|\\d{1,2})\\b`,
    ),
  );
  if (past) {
    const offset = MINUTE_WORDS[past[1].replace(/\s+/g, " ")];
    const rawHour = past[3].replace(/\s+/g, " ");
    const hour = /^\d+$/.test(rawHour) ? Number(rawHour) : HOUR_WORDS[rawHour];
    if (offset !== undefined && hour !== undefined) {
      const meridiem =
        past[2] === "past"
          ? applyMeridiem({ hour, minute: offset }, text, now, base, literalTime)
          : applyMeridiem(
              { hour: (hour + 23) % 24, minute: 60 - offset },
              text,
              now,
              base,
              literalTime,
            );
      return hit(past, meridiem.value, meridiem.spans);
    }
  }

  // 14h · 14 hs · 14 horas · às 14h · at 14 · 9 pm · 9 da noite · 9 o clock
  // 1º e 3º ramo precisam do CONNECTOR_RE: sem ele, "às 14h"/"at 9am" só casa a hora e o conector
  // sobra no título — e no ramo am/pm o ramo "as|at" nem ajuda, porque "9a" não tem \b no meio.
  const wholeHour = text.match(
    new RegExp(
      `${CONNECTOR_RE}\\b(\\d{1,2})\\s*(?:h\\b|hs\\b|hrs?\\b|horas?\\b|o\\s*clock\\b)|${AT_RE}(\\d{1,2})\\b|${CONNECTOR_RE}\\b(\\d{1,2})(?:\\s*[ap]\\.?m\\b|[ap](?=${SHORT_MERIDIEM_END}))|\\b(\\d{1,2})\\s+(?:da|de|pela|at|in|this)\\s+(?:the\\s+)?(?:manha|tarde|noite|madrugada|morning|afternoon|evening|night)\\b`,
    ),
  );
  if (wholeHour) {
    const digits = wholeHour.slice(1).find((group) => group !== undefined);
    const hour = Number(digits);
    if (hour <= 24) {
      const clock = /\d\s*(?:h|hs|hrs?|horas?)\b/.test(wholeHour[0]);
      const meridiem = applyMeridiem({ hour, minute: 0 }, text, now, base, literalTime || clock);
      return hit(wholeHour, meridiem.value, meridiem.spans);
    }
  }

  // às duas · às duas e meia · at two thirty · duas horas · duas da tarde — sem conector, "uma
  // pizza" e "cinco capítulos" virariam 13h e 17h.
  const spelledTail = `(${HOUR_WORD_RE})\\b(?:\\s+(?:e\\s+)?(${MINUTE_WORD_RE})\\b)?`;
  const spelled =
    text.match(new RegExp(`${AT_RE}${spelledTail}(?:\\s+(?:horas?|o\\s*clock)\\b)?`)) ??
    text.match(
      new RegExp(
        `\\b${spelledTail}(?:\\s+(?:horas?|o\\s*clock)\\b|(?=\\s+(?:da|de|pela|in|at)\\s+(?:the\\s+)?(?:manha|tarde|noite|madrugada|morning|afternoon|evening|night)\\b))`,
      ),
    );
  if (spelled) {
    const hour = HOUR_WORDS[spelled[1].replace(/\s+/g, " ")];
    const minute = spelled[2] ? MINUTE_WORDS[spelled[2].replace(/\s+/g, " ")] : 0;
    if (hour !== undefined) {
      const meridiem = applyMeridiem({ hour, minute }, text, now, base, literalTime);
      return hit(spelled, meridiem.value, meridiem.spans);
    }
  }

  // "amanhã de manhã": o período é a única pista de horário
  const period = periodHour(text);
  return period === null ? null : { value: { hour: period.value, minute: 0 }, spans: period.spans };
}

/** A próxima data com esse dia a partir de hoje, andando `step` meses: 12 pra data sem ano
 * ("10 de fevereiro" em novembro é o do ano que vem; 29/02 espera o bissexto), 1 pra "dia 31". */
function upcoming(now: Date, month: number, day: number, step: 1 | 12): Date | null {
  for (let i = 0; i < 12; i++) {
    const date = zonedAt(now.getFullYear(), month + i * step, day);
    if (date.getDate() === day && date >= startOfDay(now)) return date;
  }
  return null;
}

/** Dia/mês com ano explícito vale como está; sem ano, é a próxima ocorrência. */
function dated(now: Date, month: number, day: number, rawYear?: string): Date | null {
  if (month < 0 || month > 11) return null;
  if (!rawYear) return upcoming(now, month, day, 12);
  const year = Number(rawYear) < 100 ? 2000 + Number(rawYear) : Number(rawYear);
  const date = zonedAt(year, month, day);
  return date.getDate() === day && date.getMonth() === month ? date : null;
}

const ORDINAL = "(?:st|nd|rd|th)\\b";
const dayNumber = (raw: string) =>
  raw === "primeiro" ? 1 : (HOUR_WORDS[raw.replace(/\s+/g, " ")] ?? Number(raw));

const YEAR_SUFFIX = "(?:,?\\s+(?:de\\s+)?(\\d{4})\\b)?";
// "out 15"/"set 15"/"Marco 15" é "check out 15 recipes" e "ligar pro Marco 15h" — em pt o mês vem
// depois do dia, então essas três só valem na ordem dia-mês.
const MONTH_FIRST_RE = alternation(
  Object.keys(MONTHS).filter((key) => !["out", "set", "marco"].includes(key)),
);

const WEEKDAY_MATCH_RE = new RegExp(
  `\\b(${WEEKDAY_RE})(?:\\s*feira)?\\b\\.?(?!\\s+(?:via|chamada|vez|opcao|mao)\\b)`,
  "g",
);
// Abreviação que também é palavra ("ter aula", "sex education", "sun cream", "buy wed dress") só
// conta perto de uma preposição, de uma hora ou no fim da frase.
const AMBIGUOUS_WEEKDAYS = ["ter", "sex", "dom", "sab", "qua", "seg", "sun", "wed", "sat"];
const DAY_BEFORE_RE =
  /\b(?:na|no|nesta|neste|nessa|nesse|essa|esse|esta|este|ate|proxim[ao]|prox|toda|todo|on|by|this|next|every|until|before)\s+$/;
const DAY_AFTER_RE =
  /^(?:\s*feira|\s*$|\s*[,.]|\s+\d|\s+(?:as|at|que\s+vem|de\s+(?:manha|tarde|noite)|morning|afternoon|evening|night|noon|meio\s*dia)\b)/;

function weekdayInContext(text: string, match: RegExpMatchArray): boolean {
  if (!AMBIGUOUS_WEEKDAYS.includes(match[1])) return true;
  const [start, end] = spanOf(match);
  return DAY_BEFORE_RE.test(text.slice(0, start)) || DAY_AFTER_RE.test(text.slice(end));
}

// "segunda, 23 de novembro" / "4 de dezembro, sexta": o dia da semana colado na data só a confirma.
function withWeekday(text: string, match: RegExpMatchArray, date: Date): Hit<Date> {
  const [start, end] = spanOf(match);
  const spans: Span[] = [[start, end]];
  const before = text
    .slice(0, start)
    .match(new RegExp(`\\b(?:${WEEKDAY_RE})(?:\\s*feira)?[\\s,]*$`));
  if (before) spans.push([before.index ?? 0, start]);
  const after = text.slice(end).match(new RegExp(`^[\\s,]*(?:${WEEKDAY_RE})(?:\\s*feira)?\\b`));
  if (after) spans.push([end, end + after[0].length]);
  return { value: date, spans };
}

/** `weekday`: veio de um dia da semana, que pula uma semana se hoje já passou da hora. */
function parseDay(text: string, now: Date): (Hit<Date> & { weekday?: boolean }) | null {
  const today = text.match(
    /\b(?:ainda\s+|later\s+)?(?:hoje|hj|today)(?:\s+mesmo)?\b|\b(?:daqui\s+a\s+pouco|in\s+a\s+bit)\b/,
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
    /\bton(?:ight|ite)\b|\b(?:esta|essa|nesta|nessa)\s+(?:noite|manha|tarde)\b|\bthis\s+(?:morning|afternoon|evening)\b/,
  );
  if (tonight) return hit(tonight, startOfDay(now));

  // daqui a 3 dias · in 2 weeks · em uma semana · daqui a 2 meses · 3 days from now
  const relative =
    text.match(
      new RegExp(
        `\\b(?:daqui(?:\\s+a)?|em|in|dentro\\s+de|within)\\s+(${AMOUNT_RE})\\s*(dias?|days?|semanas?|weeks?|mes(?:es)?|months?|anos?|years?)\\b`,
      ),
    ) ?? text.match(new RegExp(`\\b(${AMOUNT_RE})\\s+(days?|weeks?|months?)\\s+from\\s+now\\b`));
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
    /\b(?:(?:n?o|at\s+the|by)\s+)?(?:(?:fim|final)\s+d[oe]\s+mes|end\s+of\s+(?:the\s+)?month)\b/,
  );
  if (monthEnd) return hit(monthEnd, zonedAt(now.getFullYear(), now.getMonth() + 1, 0));
  const weekEnd = text.match(
    /\b(?:(?:n?o|at\s+the|by)\s+)?(?:(?:fim|final)\s+da\s+semana|end\s+of\s+(?:the\s+)?week)\b/,
  );
  if (weekEnd) return hit(weekEnd, nextWeekday(now, 5));
  const monthStart = text.match(
    /\b(?:n?o\s+)?(?:comeco|inicio)\s+d[oe]\s+mes\b|\b(?:at\s+the\s+)?(?:start|beginning)\s+of\s+(?:the\s+)?month\b/,
  );
  if (monthStart) {
    const first =
      now.getDate() === 1 ? startOfDay(now) : zonedAt(now.getFullYear(), now.getMonth() + 1, 1);
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
  const weekWord = text.match(/\b(semana|week)\b/);
  if (nextWord && weekWord) return hit(nextWord, addDays(now, 7), [spanOf(weekWord)]);

  return null;
}

export interface ParsedDuration {
  duration: string;
  start: { hour: number; minute: number } | null;
}

/** minutos → "1h30m" / "45m" / "2h", o formato que `Task.duration` já usa. */
function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours ? `${hours}h` : ""}${minutes ? `${minutes}m` : ""}` || "0m";
}

// Um lado do intervalo: "14h", "14:30", "3pm", "2 da tarde", "meio-dia". Sem grupo de captura de
// propósito — quem lê o pedaço casado é o `readClock`. A unidade solta ("14h") faz parte do relógio,
// senão o conector do intervalo casa em cima do próprio "h".
const CLOCK = String.raw`(?:\d{1,2}(?:\s*[:h.,]\s*\d{2}|\s*h\b)?(?:\s*[ap]\.?m\b\.?|\s+(?:da|de)\s+(?:manha|tarde|noite|madrugada)\b)?|meio\s*dia|noon|meia\s*noite|midnight)`;

interface Clock {
  hour: number;
  minute: number;
  /** Tem marca de relógio (h, :mm, am/pm, período) — "15" seco não tem. */
  marked: boolean;
  meridiem: "am" | "pm" | null;
}

function readClock(raw: string): Clock {
  if (/^(?:meio|noon)/.test(raw)) return { hour: 12, minute: 0, marked: true, meridiem: null };
  if (/^(?:meia|midnight)/.test(raw)) return { hour: 0, minute: 0, marked: true, meridiem: null };
  const [, hour = "0", minute = "0"] = raw.match(/^(\d{1,2})(?:\s*[:h.,]\s*(\d{2}))?/) ?? [];
  const meridiem = /(?:p\.?m\.?|tarde|noite)$/.test(raw)
    ? "pm"
    : /(?:a\.?m\.?|manha|madrugada)$/.test(raw)
      ? "am"
      : null;
  return {
    hour: Number(hour),
    minute: Number(minute),
    marked: raw !== hour || meridiem !== null,
    meridiem,
  };
}

const to24 = ({ hour, meridiem }: Clock) =>
  meridiem === "pm" && hour < 12 ? hour + 12 : meridiem === "am" && hour === 12 ? 0 : hour;

// Com cara de compromisso, "de 10 a 11" é horário; "jogo de 2 a 3" e "páginas de 15 a 20" não.
const MEETING_RE = /\b(?:reuniao|meeting|call|aula|consulta|entrevista|plantao|turno|expediente)\b/;

const RANGE_RE = new RegExp(
  String.raw`(?<![/:.,])\b(?:(das|da|do|de|from|between|entre)\s+)?(${CLOCK})(\s+(?:(as|a|ate|to|until|till|e|and)\s+)?)(${CLOCK})(?![\d/:])`,
  "g",
);

/**
 * "das 15 às 16" · "15h às 16h" · "entre 14h e 15h" · "from 3 to 4pm" · "3-4pm" · "14:00-15:30".
 * Cada forma tem a sua trava contra número que não é hora ("jogo de 2 a 3", "15/08 a 16/08",
 * "páginas de 15 a 20"): sem prefixo, os dois lados precisam de marca de relógio; "e"/"and" só com
 * "entre"/"between"; o traço (que o normalize virou espaço — por isso o `original`) só entre horas.
 */
function parseRange(text: string, original: string): (ParsedDuration & { spans: Span[] }) | null {
  for (const match of text.matchAll(RANGE_RE)) {
    const [whole, prefix, rawStart, sep, word, rawEnd] = match;
    const index = match.index ?? 0;
    const sepStart = index + whole.indexOf(rawStart) + rawStart.length;
    const a = readClock(rawStart);
    const b = readClock(rawEnd);
    const bare = !a.marked && !b.marked;

    let ok: boolean;
    if (!word) {
      // Traço de verdade no original, e não um pedaço de "01-12-2026" ou "Dec 13-15".
      ok =
        /[-–—]/.test(original.slice(sepStart, sepStart + sep.length)) &&
        !/\d\s*[-–—/]\s*$/.test(original.slice(0, index)) &&
        !/^\s*[-–—/]\s*\d/.test(original.slice(index + whole.length)) &&
        !new RegExp(`\\b(?:${MONTH_RE})\\.?\\s*$`).test(text.slice(0, index)) &&
        (!bare || (a.hour <= 12 && b.hour <= 12));
    } else if (word === "e" || word === "and") {
      ok = prefix === "entre" || prefix === "between";
    } else if (!prefix) {
      ok = a.marked && b.marked;
    } else {
      // Sem marca, "ate" e "de N a M" são contagem ("das 5 até 10", "páginas de 15 a 20").
      ok =
        !bare ||
        ["as", "to", "until", "till"].includes(word) ||
        (word === "a" && (prefix !== "de" || MEETING_RE.test(text)));
    }
    // "de 13 a 15 de dezembro" é intervalo de dias, não de horas.
    if (
      !ok ||
      new RegExp(`^\\s+(?:de\\s+)?(?:${MONTH_RE})\\b`).test(text.slice(index + whole.length))
    ) {
      continue;
    }

    let start = to24(a);
    let end = to24(b);
    if (!a.meridiem && b.meridiem === "pm" && a.hour < 12 && a.hour + 12 <= end)
      start = a.hour + 12;
    else if (bare) {
      // "das 3 às 4" é de tarde (mesma regra do `applyMeridiem`, que aqui não vê o dia); "12-1" é 12h–13h.
      if (start >= 1 && start < 7) start += 12;
      if (end < start && end + 12 > start) end += 12;
    }
    if (start > 24 || end > 24 || a.minute > 59 || b.minute > 59) continue;

    let minutes = end * 60 + b.minute - (start * 60 + a.minute);
    // Virar a meia-noite ("das 23h à 1h") vale com marca de relógio; "das 22 às 6" seco é contagem.
    if (minutes <= 0 && !bare) minutes += 24 * 60;
    if (minutes <= 0) continue;

    return {
      spans: [[index, index + whole.length]],
      duration: formatDuration(minutes),
      start: { hour: start % 24, minute: a.minute },
    };
  }
  return null;
}

// Palavra que só anuncia a duração ("call de 1h", "for 2 hours") e sai do título junto.
const LASTS = String.raw`((?:de|por|durante|for|lasting|com\s+duracao\s+de)\s+)?`;
// "daqui a 2 horas"/"in 30 min" é hora relativa; "às 2 horas" é hora; "a cada 2 horas" é série.
const NOT_DURATION = String.raw`(?<!(?:\b(?:daqui(?:\s+a)?|em|in|dentro|de|as|das|pelas|at|ate|every|cada|half|meia)|[:.,])\s*)`;
const HOUR_UNIT = String.raw`(h|hs|hrs?|horas?|hours?)`;
const MINUTE_UNIT = String.raw`(?:min|mins|minutos?|minutes?)`;

/** "2", "1.5", "an", "duas" → horas. */
function amountOf(raw: string): number {
  const value = raw.replace(/\s+/g, " ");
  if (value === "an" || value === "a") return 1;
  return HOUR_WORDS[value] ?? Number(value.replace(",", "."));
}

/**
 * Intervalo primeiro, duração depois. A ordem é a regra de precedência do spec: em "das 15 às 16"
 * o detector de horário simples também casaria o "15", e os dois spans brigariam.
 *
 * `original` é o input antes do normalize (mesmo comprimento) — só o intervalo com traço precisa.
 */
export function parseDuration(
  text: string,
  original = text,
): (ParsedDuration & { spans: Span[] }) | null {
  const range = parseRange(text, original);
  if (range) return range;

  const found = (match: RegExpMatchArray, minutes: number) =>
    minutes > 0 ? { spans: [spanOf(match)], duration: formatDuration(minutes), start: null } : null;

  const half = text.match(
    new RegExp(`${NOT_DURATION}\\b${LASTS}(?:meia\\s+hora|half\\s+an?\\s+hour)\\b`),
  );
  if (half) return found(half, 30);

  // 2h · 2 horas · uma hora e meia · 1h30 · 1 hora e 30 minutos · 1 hr 30 min · 1.5 hours
  const allHours = [
    ...text.matchAll(
      new RegExp(
        `${NOT_DURATION}\\b${LASTS}(\\d{1,3}(?:[.,]\\d)?|an|${HOUR_WORD_RE})\\s*${HOUR_UNIT}(?![a-z])(?!\\s*[ap]\\.?m\\b|\\s+(?:da|de|pela)\\s+(?:manha|tarde|noite|madrugada)\\b)(?:\\s*(?:e|and)\\s+(meia|a\\s+half)\\b|\\s*(?:(?:e|and)\\s+)?(\\d{1,2}|${MINUTE_WORD_RE})\\s*(?:${MINUTE_UNIT}|m)?\\b)?`,
        "g",
      ),
    ),
  ];
  // Com prefixo primeiro: em "10h por 1h" a duração é o "por 1h", não o "10h".
  for (const hours of [...allHours.filter((m) => m[1]), ...allHours.filter((m) => !m[1])]) {
    const [whole, prefix, rawAmount, unit, andHalf, rawMinutes] = hours;
    const amount = amountOf(rawAmount);
    // Sem prefixo, "14h"/"9h30" é horário: só vira duração o que é por extenso ("duas horas"), o
    // que não pode ser hora de tarefa (1h–4h, 24h+) ou a frase que já tem outra hora ("2h workshop
    // thursday 1pm"). "Nh" (letra) ainda precisa estar no fim: "reunião sala 3h andar" não é 3 horas.
    const spelled = !/^\d/.test(rawAmount);
    const implausible = (amount >= 1 && amount <= 4) || amount >= 24;
    const atEnd =
      !/^hs?$/.test(unit) || /^[\s,.;!?]*$/.test(text.slice((hours.index ?? 0) + whole.length));
    const otherTime = () => parseTime(mask(text, [spanOf(hours)]), zoned(), "other") !== null;
    if (prefix || spelled || (implausible && atEnd) || otherTime()) {
      const extra = andHalf ? 30 : suffixMinutes(rawMinutes);
      const result = found(hours, Math.round(amount * 60) + extra);
      if (result) return result;
    }
  }

  // 10 min · 30 minutos · quarenta minutos · 90 minutes
  const minutes = text.match(
    new RegExp(
      `${NOT_DURATION}(?<!\\b(?:horas?|hours?)\\s+(?:e|and)\\s+)\\b${LASTS}(\\d{1,3}|${MINUTE_WORD_RE})\\s*${MINUTE_UNIT}\\b`,
    ),
  );
  if (minutes) {
    const raw = minutes[2].replace(/\s+/g, " ");
    return found(minutes, /^\d+$/.test(raw) ? Number(raw) : (MINUTE_WORDS[raw] ?? 0));
  }

  return null;
}

// Recorrência lê a hora literal: o "9h" de uma série é 9h, não as 21h que seriam a próxima "9" de hoje.
// `start` é o início de um intervalo, que o `parseDuration` já resolveu e tirou da vista daqui.
export function parseWhen(
  input: string,
  now: Date = zoned(),
  literalTime = false,
  start: Time | null = null,
): ParsedWhen | null {
  const text = normalize(input);
  if (!text.trim() && !start) return null;

  const day = parseDay(text, now);
  const today = startOfDay(now).getTime();
  const base: Base =
    literalTime || day?.weekday
      ? "other"
      : !day
        ? "none"
        : day.value.getTime() === today
          ? "today"
          : "other";

  const time = start ? { value: start, spans: [] } : parseTime(text, now, base, literalTime);
  if (!day && !time) return null;
  const baseDay = day?.value ?? startOfDay(now);
  const at = (days: number) =>
    zonedAt(
      baseDay.getFullYear(),
      baseDay.getMonth(),
      baseDay.getDate() + (time?.value.days ?? 0) + days,
      time?.value.hour ?? 0,
      time?.value.minute ?? 0,
    );
  let date = at(0);
  // Hora sem dia que já passou é a de amanhã; "domingo" num domingo que já passou da hora (ou sem
  // hora) é o da semana que vem. A recorrência acha a própria ocorrência em `nextOccurrence`.
  if (!literalTime && date < now) {
    if (!day) date = at(1);
    else if (day.weekday) date = at(7);
  }

  return {
    date,
    hasDay: day !== null,
    hasTime: time !== null,
    spans: mergeSpans([...(day?.spans ?? []), ...(time?.spans ?? [])]),
  };
}

const WEEKDAY_ITEM = `(?:${WEEKDAY_RE})s?(?:\\s*feiras?)?\\b`;
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
const weekly = (indexes: number[]) => ({ Weekly: indexes.map((i) => weekDays[i]) });
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
      `\\b(?:${EVERY}\\s+(?:[ao]s\\s+)?|every\\s+)${WEEKDAY_ITEM}(?:${LIST_SEP}${WEEKDAY_ITEM})*`,
    ),
    (match) => weekly(weekdaysIn(match[0])),
  ],
  // às segundas · aos sábados · on Mondays · segundas e quartas · seg qua sex
  [
    new RegExp(
      `\\b(?:(?:[ao]s|aos|nas|nos|on)\\s+${PLURAL_WEEKDAY}|${WEEKDAY_ITEM}(?=${LIST_SEP}${WEEKDAY_ITEM}))(?:${LIST_SEP}${WEEKDAY_ITEM})*`,
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
    /\b(?:tod[ao]s?\s+(?:os\s+)?anos?|anualmente|every\s+year|(?:a\s+)?cada\s+ano|uma\s+vez\s+por\s+ano|once\s+a\s+year)\b/,
    () => "Yearly",
  ],
];

// "take meds daily", e não "daily standup"/"weekly report": o advérbio inglês só vale no fim da
// frase ou antes da hora.
const ADVERB_RE =
  /(?<=\S\s+)\b(daily|weekly|monthly|yearly|annually)\b(?=\s*$|\s*[,.;!]|\s+(?:at|as|on|@|\d))/;

// todas as manhãs · toda noite · every morning: diária com a hora do período
const DAILY_PERIOD_RE =
  /\b(?:(?:tod[ao]s?|td[ao]?s?)\s+(?:as\s+)?|every\s+|each\s+)(manhas?|tardes?|noites?|madrugadas?|morning|afternoon|evening|night)\b/;

/** Recorrência no texto já normalizado; sem gatilho ("toda", "every", "diariamente"…) é `null`.
 * `hour` vem de "todas as manhãs": a série diz a hora quando o texto não diz. `original` (o input
 * antes do normalize) só serve pro traço de "mon-fri". */
export function parseRepeat(
  text: string,
  now: Date = zoned(),
  original = text,
): { value: Exclude<Repeat, "Off">; spans: Span[]; hour?: number } | null {
  const dashed = text.match(new RegExp(`\\b(${WEEKDAY_RE}) (${WEEKDAY_RE})\\b`));
  if (dashed && /[-–—]/.test(original[(dashed.index ?? 0) + dashed[1].length])) {
    const [from, to] = [WEEKDAYS[dashed[1]], WEEKDAYS[dashed[2]]];
    if (from < to) return hit(dashed, weekly(ALL_WEEK.filter((i) => i >= from && i <= to)));
  }

  const daily = text.match(DAILY_PERIOD_RE);
  if (daily) {
    const word = daily[1];
    const hour = /^(?:manha|morning)/.test(word)
      ? PERIOD_HOURS.morning
      : /^(?:tarde|afternoon)/.test(word)
        ? PERIOD_HOURS.afternoon
        : /^madrugada/.test(word)
          ? PERIOD_HOURS.dawn
          : PERIOD_HOURS.evening;
    return { ...hit(daily, "Daily"), hour };
  }

  const adverb = text.match(ADVERB_RE);
  if (adverb) {
    const word = adverb[1];
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
    const value = toRepeat(match, now);
    const [start, end] = spanOf(match);
    const extra =
      value === "Monthly"
        ? [...text.matchAll(new RegExp(MONTHLY_SOURCE, "g"))]
            .map(spanOf)
            .filter(([s, e]) => e <= start || s >= end)
        : [];
    return hit(match, value, extra);
  }
  return null;
}

/** A primeira ocorrência da série a partir de `date` — hoje vale se a hora não passou (ou não há hora). */
function nextOccurrence(repeat: Exclude<Repeat, "Off">, date: Date, hasTime: boolean, now: Date) {
  const passed = (d: Date) => (hasTime ? d < now : d < startOfDay(now));
  const shift = (days: number, months = 0, years = 0) =>
    zonedAt(
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

export interface ParsedTask {
  text: string;
  date: Date | null;
  /** Falso quando `date` só tem dia (hora ficou 00:00 por padrão) — quem consome decide o default. */
  hasTime: boolean;
  /** Dia explícito ("qui", "dia 5") ou recorrência semanal com dias citados ("toda quarta"). */
  hasDay: boolean;
  duration: string | null;
  links: string[];
  repeat: Repeat;
}

/** Tira os spans do texto, do fim pro começo — cortar de frente invalidaria os índices seguintes. */
const ORPHAN_PUNCT = /[,;.!?]/;

// Preposição que só existia pra apontar pro trecho recortado ("reunião NO meet…"). Sem o trecho,
// ela aponta pro nada — perde o referente no fim ou no meio da frase, não importa o que vem depois.
// Vale pro conector do tempo também: "até [sexta]", "essa [sexta]", "consulta dia [23/11]", "on [monday]".
const ORPHAN_PREP =
  /(?:^|\s)(no|na|nos|nas|em|pelo|pela|pelos|pelas|via|pro|pra|com|de|do|da|ate|até|essa|esse|esta|este|nesta|neste|nessa|nesse|dia|ao|à|a|o|the|on|by|this|at|in|until|before|antes)$/i;

/**
 * Reconcilia só o que ficou colado nas duas pontas de UM corte — nunca varre o título inteiro.
 * É por isso que "uau!!" longe de qualquer span sai intocado: sem seam ali, a função nem olha
 * pra ele. `isLast` distingue "sobrou separador de lista sem nada depois" (corte foi até o fim
 * da frase) de "ainda vem mais texto" (onde o mesmo string vazio à direita é só o gap entre dois
 * spans, não o fim de verdade).
 */
function joinAcrossCut(left: string, right: string, isLast: boolean): string {
  const leftTrimmed = left.replace(/\s+$/, "");
  const rightTrimmed = right.replace(/^\s+/, "");
  const leftLast = leftTrimmed.at(-1);
  const rightFirst = rightTrimmed[0];

  // nada sobrou a esquerda: pontuacao orfa no comeco da frase nao tem o que separar
  if (!leftTrimmed && rightFirst && ORPHAN_PUNCT.test(rightFirst)) {
    return joinAcrossCut("", rightTrimmed.slice(1), isLast);
  }

  // "[meia hora] de caminhada": sem nada antes, o "de" ligava o corte ao resto
  if (!leftTrimmed && /^de\s/i.test(rightTrimmed))
    return joinAcrossCut("", rightTrimmed.slice(3), isLast);

  // parenteses/colchetes que ficaram vazios na fronteira do corte
  if ((leftLast === "(" && rightFirst === ")") || (leftLast === "[" && rightFirst === "]")) {
    return joinAcrossCut(leftTrimmed.slice(0, -1), rightTrimmed.slice(1), isLast);
  }

  // pontuacao dos dois lados da MESMA fronteira (ex.: "reuniao, [corte], com o time"): fica so a da esquerda
  if (leftLast && ORPHAN_PUNCT.test(leftLast) && rightFirst && ORPHAN_PUNCT.test(rightFirst)) {
    return leftTrimmed + rightTrimmed.slice(1);
  }

  // corte foi ate o fim da frase e deixou separador de lista pendurado, sem nada depois pra separar
  if (isLast && !rightTrimmed && leftLast && /[,;]/.test(leftLast)) {
    return leftTrimmed.slice(0, -1);
  }

  // a preposicao logo antes do corte apontava pro trecho removido, nao pro que vem depois — perde
  // o referente esteja o corte no fim da frase ou no meio, entao nao depende de isLast/rightTrimmed
  const withoutPrep = leftTrimmed.replace(ORPHAN_PREP, "");
  if (withoutPrep !== leftTrimmed) return joinAcrossCut(withoutPrep, rightTrimmed, isLast);

  // pontuacao colada logo depois do corte: sem espaco antes dela
  if (rightFirst && ORPHAN_PUNCT.test(rightFirst)) {
    return leftTrimmed + rightTrimmed;
  }

  if (!leftTrimmed) return rightTrimmed;
  if (!rightTrimmed) return leftTrimmed;
  return `${leftTrimmed} ${rightTrimmed}`;
}

/** Exportada pro teste medir spans com o mesmo recorte da produção, não com um recorte paralelo. */
export function cut(input: string, spans: Span[]): string {
  const ordered = [...spans].sort((a, b) => a[0] - b[0]);
  const segments: string[] = [];
  let pos = 0;
  for (const [start, end] of ordered) {
    segments.push(input.slice(pos, start));
    pos = end;
  }
  segments.push(input.slice(pos));

  let acc = segments[0];
  for (let i = 1; i < segments.length; i++) {
    acc = joinAcrossCut(acc, segments[i], i === segments.length - 1);
  }
  return acc.replace(/\s+/g, " ").trim();
}

/** Troca os trechos por espaço em vez de apagá-los: remover deslocaria todos os índices seguintes. */
const mask = (text: string, spans: Span[]) =>
  text
    .split("")
    .map((char, i) => (spans.some(([s, e]) => i >= s && i < e) ? " " : char))
    .join("");

// Em pt dia da semana, mês e período se escrevem em minúscula — com maiúscula no meio da frase é nome
// próprio ("Sessão da Tarde", "Rua 7 de Setembro", "Dom Casmurro", "O Quinze"). Vale igual pros
// "Morning"/"Tonight"/"Tomorrow" e números por extenso do inglês ("Good Morning America").
const CAPITALIZED_NAME_WORDS = new Set([
  ...["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"],
  ...["dom", "seg", "ter", "qua", "qui", "sex", "sab"],
  ...["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto"],
  ...["setembro", "outubro", "novembro", "dezembro"],
  ...["manha", "tarde", "noite", "madrugada", "meio", "meia", "hoje", "amanha"],
  ...[
    "morning",
    "afternoon",
    "evening",
    "night",
    "tonight",
    "midnight",
    "noon",
    "today",
    "tomorrow",
    "weekend",
  ],
  ...[...Object.keys(HOUR_WORDS), ...Object.keys(MINUTE_WORDS)].filter((key) => !key.includes(" ")),
]);
// O inglês capitaliza dia e mês sempre: ali só é nome quando cola em outra palavra com maiúscula
// ("Black Friday", "Cyber Monday", "Sunday Times") — "Monday Nov 23" continua sendo data.
const EN_DATE_WORD = new RegExp(`^(?:${WEEKDAY_RE}|${MONTH_RE})$`);
// "na Sexta", "until Monday": com a preposição na frente é dia mesmo.
const BEFORE_DAY_WORD =
  /^(?:na|no|ate|essa|esta|nesta|neste|nessa|proxima|proximo|toda|todo|on|by|this|next|every|until)$/;

const PT_FUNCTION_WORDS = new Set(["na", "no", "da", "do", "pra", "pro", "com", "um", "uma"]);

/** Spans dos nomes próprios que têm cara de data ou hora — escondidos dos detectores, mantidos no título. */
function properNouns(input: string): Span[] {
  const words = [...input.matchAll(/[\p{L}\p{N}]+/gu)].map((match) => {
    const start = match.index ?? 0;
    return {
      key: normalize(match[0]),
      span: [start, start + match[0].length] satisfies Span,
      capital: /^\p{Lu}/u.test(match[0]),
    };
  });
  const spans = [...input.matchAll(/\bfriday the 13th\b|\bcaf[eé] da manh[aã](?!\p{L})/giu)].map(
    spanOf,
  );
  // Título Em Caixa Alta Ou Tudo Maiúsculo: a maiúscula não diz mais nada.
  if (words.every(({ key, capital }) => capital || !/^[a-z]/.test(key))) return spans;
  words.forEach(({ key, span, capital }, i) => {
    if (!capital || i === 0 || BEFORE_DAY_WORD.test(words[i - 1].key)) return;
    const glued = (j: number) => {
      const other = words[j];
      if (!other || j === 0 || !other.capital || EN_DATE_WORD.test(other.key)) return false;
      const [left, right] = j < i ? [other.span, span] : [span, other.span];
      return /^[\s-]+$/.test(input.slice(left[1], right[0]));
    };
    // "Robinson Crusoe and Friday": dia da semana ligado por "and" a outro nome é nome.
    const joined = /^(?:and|e)$/.test(words[i - 1].key) && words[i - 2]?.capital && i - 2 > 0;
    // "assistir Wednesday na Netflix": dia em inglês numa frase em pt, solto, é título.
    const englishInPt =
      key in WEEKDAYS &&
      key.length > 5 &&
      words.some((word) => PT_FUNCTION_WORDS.has(word.key)) &&
      !DAY_AFTER_RE.test(normalize(input.slice(span[1])));
    if (
      CAPITALIZED_NAME_WORDS.has(key) ||
      (EN_DATE_WORD.test(key) && (glued(i - 1) || glued(i + 1) || joined || englishInPt))
    ) {
      spans.push(span);
    }
  });
  return spans;
}

export function parseTaskText(input: string, now: Date = zoned()): ParsedTask {
  const normalized = normalize(input);
  const links = parseLinks(input);

  // "youtu.be/15h30" não pode virar horário nem duração; "Sessão da Tarde" e "Dom Casmurro" também não.
  const forDuration = mask(normalized, [...links.spans, ...properNouns(input)]);
  const duration = parseDuration(forDuration, input);

  // A duração também sai da vista do parseWhen: o "1h" de "call de 1h hoje às 16h" casa como hora
  // e, por ter o span maior, ganhava do horário de verdade.
  const forWhen = mask(forDuration, duration?.spans ?? []);

  // "toda quarta" sai da vista do parseWhen, que leria "quarta" como dia; "dia 5"/"3 de março"
  // ficam fora do span da recorrência e ele ainda lê. O intervalo manda no horário: "das 15 às 16"
  // começa 15:00, e o parseWhen só põe o dia (ou rola pra amanhã se já passou).
  const repeat = parseRepeat(forWhen, now, input);
  const forDay = mask(forWhen, repeat?.spans ?? []);
  let when = parseWhen(forDay, now, repeat !== null, duration?.start ?? null);
  if (repeat?.hour !== undefined && !when?.hasTime) {
    when = parseWhen(forDay, now, true, { hour: repeat.hour, minute: 0 });
  }

  const spans = mergeSpans([
    ...links.spans,
    ...(duration?.spans ?? []),
    ...(repeat?.spans ?? []),
    ...(when?.spans ?? []),
  ]);

  const hasTime = when?.hasTime ?? false;
  const date = repeat
    ? nextOccurrence(repeat.value, when?.date ?? startOfDay(now), hasTime, now)
    : (when?.date ?? null);

  // "toda quarta" cita dias; "dias úteis" também (seg–sex); "toda semana" não.
  const citesWeekday =
    typeof repeat?.value === "object" &&
    repeat.spans.some(([start, end]) =>
      new RegExp(
        `\\b(?:${WEEKDAY_RE})s?\\b|\\b(?:dias?\\s+uteis?|weekdays?|weekends?|(?:fim|fins|final|finais)\\s+de|durante)\\b`,
      ).test(forWhen.slice(start, end)),
    );

  return {
    text: cut(input, spans),
    date,
    hasTime,
    hasDay: Boolean(when?.hasDay) || citesWeekday,
    duration: duration?.duration ?? null,
    links: links.urls,
    repeat: repeat?.value ?? "Off",
  };
}
