import { parseLinks } from "./parse-links";

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

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

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

const NEXT_RE = /\b(proxim[ao]|que\s+vem|next)\b/;

const MINUTE_SUFFIX_RE = `(?:\\s+(?:e|and)\\s+(${MINUTE_WORD_RE}|\\d{1,2}))?`;

// "às"/"at" logo antes da hora: sem isso no span, "hoje às 16:30" recorta só "16:30" e deixa "às" no título.
const CONNECTOR_RE = "(?:\\b(?:as|at)\\s+)?";

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
}

/**
 * Resolve o período quando o texto não diz manhã/tarde/noite. Duas regras, porque o que é
 * plausível depende do dia:
 *
 * - **Hoje** (ou sem dia): vale a próxima ocorrência. São 14h e o usuário pede "às 3"? 15h, não
 *   3h da manhã. Pede "às 9"? 21h. Se as duas leituras já passaram, fica a mais recente.
 * - **Outro dia**: leitura literal, que é o que "amanhã às 9" quer dizer (9h da manhã) — exceto
 *   1h–7h, que viram tarde/noite, porque tarefa de madrugada é rara.
 */
function applyMeridiem(time: Time, text: string, now: Date, baseIsToday: boolean): Hit<Time> {
  const pm = text.match(
    /\b(da|de|a|na|at|in|this)\s+(tarde|noite|afternoon|evening|night)\b|\d\s*pm\b|\bpm\b|\btonight\b/,
  );
  const am = text.match(
    /\b(da|de|a|na|at|in|this)\s+(manha|madrugada|morning|dawn)\b|\d\s*am\b|\bam\b/,
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
  } else if (hour >= 1 && hour <= 12) {
    const alternative = hour === 12 ? 0 : hour + 12;

    if (baseIsToday) {
      const minutesNow = now.getHours() * 60 + now.getMinutes();
      const asIs = hour * 60 + minute;
      const alt = alternative * 60 + minute;
      const asIsAhead = asIs > minutesNow;
      const altAhead = alt > minutesNow;

      if (asIsAhead && altAhead) hour = asIs <= alt ? hour : alternative;
      else if (altAhead) hour = alternative;
      else if (!asIsAhead && !altAhead) hour = asIs >= alt ? hour : alternative;
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
    [
      /\b(tonight|esta\s+noite|a\s+noite|da\s+noite|de\s+noite|evening|at\s+night)\b/,
      PERIOD_HOURS.evening,
    ],
    [/\b(de\s+manha|da\s+manha|pela\s+manha|morning)\b/, PERIOD_HOURS.morning],
    [/\b(a\s+tarde|de\s+tarde|da\s+tarde|afternoon)\b/, PERIOD_HOURS.afternoon],
    [/\b(de\s+madrugada|da\s+madrugada|dawn)\b/, PERIOD_HOURS.dawn],
  ];
  for (const [re, hour] of patterns) {
    const match = text.match(re);
    if (match) return hit(match, hour);
  }
  return null;
}

function parseTime(text: string, now: Date, baseIsToday: boolean): Hit<Time> | null {
  // daqui a 2 horas · in 90 minutes
  const relative = text.match(
    /\b(?:daqui\s+a|em|in)\s+(\d{1,3})\s*(h|hs|horas?|hours?|min|minutos?|minutes?)\b/,
  );
  if (relative) {
    const amount = Number(relative[1]);
    const isMinutes = /^min/.test(relative[2]);
    const target = new Date(now.getTime() + amount * (isMinutes ? 60_000 : 3_600_000));
    return hit(relative, { hour: target.getHours(), minute: target.getMinutes() });
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

  // 14:30 · 14h30 · 14.30 · 14,30
  const withMinutes = text.match(
    new RegExp(`${CONNECTOR_RE}\\b(\\d{1,2})\\s*[:h.,]\\s*(\\d{2})\\b`),
  );
  if (withMinutes) {
    const hour = Number(withMinutes[1]);
    const minute = Number(withMinutes[2]);
    if (hour <= 24 && minute < 60) {
      const meridiem = applyMeridiem({ hour, minute }, text, now, baseIsToday);
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
      const meridiem = applyMeridiem({ hour, minute }, text, now, baseIsToday);
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
          ? applyMeridiem({ hour, minute: offset }, text, now, baseIsToday)
          : applyMeridiem({ hour: (hour + 23) % 24, minute: 60 - offset }, text, now, baseIsToday);
      return hit(past, meridiem.value, meridiem.spans);
    }
  }

  // 14h · 14 hs · 14 horas · às 14h · at 14 · 9 pm · 9 da noite · 9 o clock
  // 1º e 3º ramo precisam do CONNECTOR_RE: sem ele, "às 14h"/"at 9am" só casa a hora e o conector
  // sobra no título — e no ramo am/pm o ramo "as|at" nem ajuda, porque "9a" não tem \b no meio.
  const wholeHour = text.match(
    new RegExp(
      `${CONNECTOR_RE}\\b(\\d{1,2})\\s*(?:h\\b|hs\\b|horas?\\b|o\\s*clock\\b)|\\b(?:as|at)\\s+(\\d{1,2})\\b|${CONNECTOR_RE}\\b(\\d{1,2})\\s*(?:am|pm)\\b|\\b(\\d{1,2})\\s+(?:da|de|at|in|this)\\s+(?:manha|tarde|noite|madrugada|morning|afternoon|evening|night)\\b`,
    ),
  );
  if (wholeHour) {
    const digits = wholeHour.slice(1).find((group) => group !== undefined);
    const hour = Number(digits);
    if (hour <= 24) {
      const meridiem = applyMeridiem({ hour, minute: 0 }, text, now, baseIsToday);
      return hit(wholeHour, meridiem.value, meridiem.spans);
    }
  }

  // duas · duas e meia · two thirty · two o clock
  const spelled = text.match(
    new RegExp(`${CONNECTOR_RE}\\b(${HOUR_WORD_RE})\\b(?:\\s+(?:e\\s+)?(${MINUTE_WORD_RE})\\b)?`),
  );
  if (spelled) {
    const hour = HOUR_WORDS[spelled[1].replace(/\s+/g, " ")];
    const minute = spelled[2] ? MINUTE_WORDS[spelled[2].replace(/\s+/g, " ")] : 0;
    if (hour !== undefined) {
      const meridiem = applyMeridiem({ hour, minute }, text, now, baseIsToday);
      return hit(spelled, meridiem.value, meridiem.spans);
    }
  }

  // "amanhã de manhã": o período é a única pista de horário
  const period = periodHour(text);
  return period === null ? null : { value: { hour: period.value, minute: 0 }, spans: period.spans };
}

function parseDay(text: string, now: Date): Hit<Date> | null {
  const today = text.match(/\b(hoje|hj|today)\b/);
  if (today) return hit(today, startOfDay(now));

  const dayAfterTomorrow = text.match(/\b(depois\s+de\s+amanha|day\s+after\s+tomorrow)\b/);
  if (dayAfterTomorrow) return hit(dayAfterTomorrow, addDays(now, 2));

  const tomorrow = text.match(/\b(amanha|amanhã|tomorrow|tmr)\b/);
  if (tomorrow) return hit(tomorrow, addDays(now, 1));

  const dayBeforeYesterday = text.match(/\b(anteontem|day\s+before\s+yesterday)\b/);
  if (dayBeforeYesterday) return hit(dayBeforeYesterday, addDays(now, -2));

  const yesterday = text.match(/\b(ontem|yesterday)\b/);
  if (yesterday) return hit(yesterday, addDays(now, -1));

  const tonight = text.match(/\btonight\b|\besta\s+noite\b/);
  if (tonight) return hit(tonight, startOfDay(now));

  // daqui a 3 dias · in 2 weeks
  const relative = text.match(
    /\b(?:daqui\s+a|em|in)\s+(\d{1,3})\s*(dias?|days?|semanas?|weeks?)\b/,
  );
  if (relative) {
    const amount = Number(relative[1]);
    const days = /^(semana|week)/.test(relative[2]) ? amount * 7 : amount;
    return hit(relative, addDays(now, days));
  }

  // 15/08 · 15/08/2026 · 15/8
  const numeric = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]) - 1;
    const rawYear = numeric[3] ? Number(numeric[3]) : now.getFullYear();
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const date = new Date(year, month, day);
    if (date.getDate() === day && date.getMonth() === month) return hit(numeric, date);
  }

  // 15 de agosto · 15 ago · august 15
  const dayFirst = text.match(new RegExp(`\\b(\\d{1,2})\\s+(?:de\\s+)?(${MONTH_RE})\\b`));
  const monthFirst = text.match(new RegExp(`\\b(${MONTH_RE})\\s+(\\d{1,2})\\b`));
  const namedMatch = dayFirst ?? monthFirst;
  const named = dayFirst
    ? { day: Number(dayFirst[1]), month: MONTHS[dayFirst[2]] }
    : monthFirst
      ? { day: Number(monthFirst[2]), month: MONTHS[monthFirst[1]] }
      : null;
  if (named && namedMatch) {
    const date = new Date(now.getFullYear(), named.month, named.day);
    if (date.getDate() === named.day) return hit(namedMatch, date);
  }

  // segunda · terça-feira · next friday — a próxima ocorrência (hoje conta como ela mesma)
  const weekday = text.match(new RegExp(`\\b(${WEEKDAY_RE})(?:\\s*feira)?\\b`));
  if (weekday) {
    const target = WEEKDAYS[weekday[1]];
    const delta = (target - now.getDay() + 7) % 7;
    // "próxima terça" pula pra semana seguinte; "terça" seca é a mais próxima — mas o span
    // sempre inclui a pista de "próxima"/"que vem" quando ela apareceu, senão sobra no título.
    const next = text.match(NEXT_RE);
    const date = addDays(now, next ? delta + 7 : delta);
    return hit(weekday, date, next ? [spanOf(next)] : []);
  }

  // semana que vem · next week, sem dia da semana junto
  const nextWord = text.match(NEXT_RE);
  const weekWord = text.match(/\b(semana|week)\b/);
  if (nextWord && weekWord) return hit(nextWord, addDays(now, 7), [spanOf(weekWord)]);

  // dia 15 — este mês se ainda não passou, senão o mês que vem
  const monthDay = text.match(/\b(?:dia|day)\s+(\d{1,2})\b/);
  if (monthDay) {
    const day = Number(monthDay[1]);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), day);
    if (thisMonth.getDate() !== day) return null;
    const date =
      thisMonth >= startOfDay(now)
        ? thisMonth
        : new Date(now.getFullYear(), now.getMonth() + 1, day);
    return hit(monthDay, date);
  }

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

// A unidade solta ("14h", sem minutos) faz parte do relógio: sem ela o `\s*(as|ate)` do intervalo
// casa em cima do próprio "h" e "das 14h às 15h" deixa de ser intervalo.
const CLOCK = String.raw`(\d{1,2})(?:\s*[:h.,]\s*(\d{2})|\s*h\b)?`;

/**
 * Intervalo primeiro, duração explícita depois. A ordem é a regra de precedência do spec: em
 * "das 15 às 16" o detector de horário simples também casaria o "15", e os dois spans brigariam.
 */
export function parseDuration(text: string): (ParsedDuration & { spans: Span[] }) | null {
  // "-"/"—" nunca aparecem aqui: normalize() já trocou hífen e travessão por espaço antes do texto
  // chegar. Prefixo E conector são obrigatórios — é o conector que barra "jogo de 2 a 3"; exigir
  // que combinem entre si só recusava "de 14h às 15h", que é português normal.
  const range = text.match(
    new RegExp(String.raw`\b(das|da|de)\s+${CLOCK}\s*(as|ate)\s*${CLOCK}\b`),
  );
  if (range) {
    const [, , hour1, minute1, , hour2, minute2] = range;
    const startMinutes = Number(hour1) * 60 + Number(minute1 ?? 0);
    const endMinutes = Number(hour2) * 60 + Number(minute2 ?? 0);
    // Intervalo que "volta no tempo" é outra coisa (data numérica, placar, o que for) — não é nosso.
    if (endMinutes > startMinutes && Number(hour1) <= 24 && Number(hour2) <= 24) {
      return {
        spans: [spanOf(range)],
        duration: formatDuration(endMinutes - startMinutes),
        start: { hour: Number(hour1), minute: Number(minute1 ?? 0) },
      };
    }
  }

  // "15h-16h" virou "15h 16h" (hífen sumiu no normalize) — sem palavra de conexão, o "h" repetido
  // dos dois lados é o único sinal de intervalo que sobrou.
  const hourRange = text.match(/\b(\d{1,2})h\s+(\d{1,2})h\b/);
  if (hourRange) {
    const startHour = Number(hourRange[1]);
    const endHour = Number(hourRange[2]);
    if (endHour > startHour && startHour <= 24 && endHour <= 24) {
      return {
        spans: [spanOf(hourRange)],
        duration: formatDuration((endHour - startHour) * 60),
        start: { hour: startHour, minute: 0 },
      };
    }
  }

  // Prefixo obrigatório ("de"/"por"/"durante"): sem ele, "14h"/"9h30" é horário, não duração — é
  // assim que boa parte dos títulos reais escreve horário em pt-BR sem essa palavra na frente.
  const half = text.match(/\b(?:de|por|durante)\s+meia\s+hora\b/);
  if (half) return { spans: [spanOf(half)], duration: "30m", start: null };

  const explicit = text.match(
    /\b(?:de|por|durante)\s+(\d{1,3})\s*(h|hs|horas?|hours?)\s*(\d{1,2})?\b|\b(?:de|por|durante)\s+(\d{1,3})\s*(min|minutos?|minutes?|m)\b/,
  );
  if (explicit) {
    const minutes = explicit[1]
      ? Number(explicit[1]) * 60 + Number(explicit[3] ?? 0)
      : Number(explicit[4]);
    if (minutes > 0) {
      return { spans: [spanOf(explicit)], duration: formatDuration(minutes), start: null };
    }
  }

  return null;
}

export function parseWhen(input: string, now: Date = new Date()): ParsedWhen | null {
  const text = normalize(input);
  if (!text.trim()) return null;

  const day = parseDay(text, now);
  const base = day?.value ?? startOfDay(now);
  const baseIsToday = base.getTime() === startOfDay(now).getTime();

  const time = parseTime(text, now, baseIsToday);
  if (!day && !time) return null;
  const date = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    time?.value.hour ?? 0,
    time?.value.minute ?? 0,
  );

  return {
    date,
    hasDay: day !== null,
    hasTime: time !== null,
    spans: mergeSpans([...(day?.spans ?? []), ...(time?.spans ?? [])]),
  };
}

export interface ParsedTask {
  text: string;
  date: Date | null;
  /** Falso quando `date` só tem dia (hora ficou 00:00 por padrão) — quem consome decide o default. */
  hasTime: boolean;
  duration: string | null;
  links: string[];
}

/** Tira os spans do texto, do fim pro começo — cortar de frente invalidaria os índices seguintes. */
const ORPHAN_PUNCT = /[,;.!?]/;

// Preposição que só existia pra apontar pro trecho recortado ("reunião NO meet…"). Sem o trecho,
// ela aponta pro nada. Só some quando nada sobra depois dela — senão é texto do usuário.
const ORPHAN_PREP = /(?:^|\s)(no|na|nos|nas|em|pelo|pela|pelos|pelas|via|pro|pra|com|de|do|da)$/i;

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

  // mesma pre-condicao: corte ate o fim, nada a direita — a preposicao final perdeu o referente
  if (isLast && !rightTrimmed) {
    const withoutPrep = leftTrimmed.replace(ORPHAN_PREP, "");
    if (withoutPrep !== leftTrimmed) return joinAcrossCut(withoutPrep, "", isLast);
  }

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

export function parseTaskText(input: string, now: Date = new Date()): ParsedTask {
  const normalized = normalize(input);
  const links = parseLinks(input);

  // "youtu.be/15h30" não pode virar horário nem duração.
  const forDuration = mask(normalized, links.spans);
  const duration = parseDuration(forDuration);

  // A duração também sai da vista do parseWhen: o "1h" de "call de 1h hoje às 16h" casa como hora
  // e, por ter o span maior, ganhava do horário de verdade.
  const when = parseWhen(mask(forDuration, duration?.spans ?? []), now);

  const spans = mergeSpans([...links.spans, ...(duration?.spans ?? []), ...(when?.spans ?? [])]);

  // O intervalo manda no horário: "das 15 às 16" começa 15:00 — e é a única fonte de hora agora que
  // o parseWhen não enxerga mais o trecho da duração.
  const base = when?.date ?? startOfDay(now);
  const date = duration?.start
    ? new Date(
        base.getFullYear(),
        base.getMonth(),
        base.getDate(),
        duration.start.hour,
        duration.start.minute,
      )
    : (when?.date ?? null);

  // Intervalo conta como hora explícita: o parseWhen nem vê esse trecho, e o início do intervalo já
  // É uma hora — sem isso o home.tsx sobrescreveria 15:00 com o DEFAULT_HOUR.
  const hasTime = Boolean(duration?.start) || (when?.hasTime ?? false);

  return {
    text: cut(input, spans),
    date,
    hasTime,
    duration: duration?.duration ?? null,
    links: links.urls,
  };
}
