import { TZDate } from "@date-fns/tz";

/** Horas assumidas quando o texto dá só o período ("amanhã de manhã", "tonight"). */
export const PERIOD_HOURS = { morning: 9, afternoon: 14, evening: 20, dawn: 6 } as const;

export const HOUR_WORDS: Record<string, number> = {
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

export const MINUTE_WORDS: Record<string, number> = {
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

export const WEEKDAYS: Record<string, number> = {
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
  qta: 4,
  // Abreviação pelas consoantes ("sxt", "qrta"); "tera" (de "tera feira") também é "terá".
  sxt: 5,
  sxta: 5,
  qrt: 3,
  qrta: 3,
  qnt: 4,
  qnta: 4,
  tera: 2,
  sabdo: 6,
  segnda: 1,
  wensday: 3,
  thrusday: 4,
};

export const MONTHS: Record<string, number> = {
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

/** O fuso da data: toda data do parser descende do `now`, um `TZDate`. Sem fuso, o runtime (no
 * Worker, UTC; no browser, o do aparelho) decidiria em silêncio — melhor quebrar. */
export function zoneOf(date: Date): string {
  if ("timeZone" in date && typeof date.timeZone === "string") return date.timeZone;
  throw new Error("parse-task: data sem fuso, passe um TZDate");
}

/** O `new Date(ano, mês, …)` no fuso de `ref`. */
export const dateIn = (ref: Date, year: number, month: number, day = 1, hours = 0, minutes = 0) =>
  new TZDate(year, month, day, hours, minutes, 0, 0, zoneOf(ref));

export const startOfDay = (d: Date) => dateIn(d, d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) =>
  dateIn(d, d.getFullYear(), d.getMonth(), d.getDate() + n);
/** "31/01 + 1 mês" é 28/02, não 03/03. */
export const addMonths = (d: Date, n: number) =>
  dateIn(
    d,
    d.getFullYear(),
    d.getMonth() + n,
    Math.min(d.getDate(), dateIn(d, d.getFullYear(), d.getMonth() + n + 1, 0).getDate()),
  );
/** A próxima ocorrência do dia da semana `target`, hoje incluso. */
export const nextWeekday = (now: Date, target: number) =>
  addDays(now, (target - now.getDay() + 7) % 7);

/** Vira alternativa de regex com as chaves mais longas primeiro — senão "vinte" come "vinte e uma". */
export const alternation = (keys: string[]) =>
  [...keys]
    .sort((a, b) => b.length - a.length)
    .join("|")
    .replace(/ /g, "\\s+");

export const HOUR_WORD_RE = alternation(Object.keys(HOUR_WORDS));
export const MINUTE_WORD_RE = alternation(Object.keys(MINUTE_WORDS));
export const WEEKDAY_RE = alternation(Object.keys(WEEKDAYS));
export const MONTH_RE = alternation(Object.keys(MONTHS));

export const NEXT_RE = /\b(?:proxim[ao]|prox|(?:que|q)\s+vem|next|nxt)\b\.?/;

// Quantidade de "daqui a uma semana", "in an hour", "em três dias".
export const AMOUNT_RE = `\\d{1,3}|an|a|${HOUR_WORD_RE}`;

export const MINUTE_SUFFIX_RE = `(?:\\s+(?:e|and)\\s+(${MINUTE_WORD_RE}|\\d{1,2}))?`;

// "às"/"at" logo antes da hora: sem isso no span, "hoje às 16:30" recorta só "16:30" e deixa "às" no título.
// "por volta das", "lá pelas", "around" são o mesmo conector, com a hora igual.
export const AT_RE =
  "(?:\\b(?:as|at|por\\s+volta\\s+d[ae]s?|la\\s+pel[ao]s|pel[ao]s|around|about)\\s+|@\\s*)";
export const CONNECTOR_RE = `${AT_RE}?`;
// "7a"/"3p" só no fim, antes do dia ou logo depois de um ("tues 6p"): "2a via" e "3a parcela" são
// ordinais. Com minutos ("4:30p") não tem como ser ordinal.
export const DAY_WORD_RE = `${WEEKDAY_RE}|tomorrow|today|tmrw?|tonight|amanha|hoje`;
export const SHORT_MERIDIEM_END = String.raw`\s*$|\s*[,.;!]|\s+(?:${DAY_WORD_RE}|on|every)\b`;
export const shortMeridiem = (letter: "a" | "p") =>
  String.raw`\d${letter}(?=${SHORT_MERIDIEM_END})|:\d{2}${letter}\b|(?<=\b(?:${DAY_WORD_RE})\s+\d{1,2})${letter}\b(?!\s+(?:via|chamada|vez|parcela)\b)`;

/** Os minutos de um "… e meia" / "… e 15"; 0 quando o sufixo não veio. */
export function suffixMinutes(raw: string | undefined): number {
  if (!raw) return 0;
  const value = raw.replace(/\s+/g, " ");
  const minutes = /^\d+$/.test(value) ? Number(value) : MINUTE_WORDS[value];
  return minutes !== undefined && minutes < 60 ? minutes : 0;
}

// "uma hora dessas" é "algum dia", não 1 hora.
export const NOT_FROM_NOW = String.raw`(?!\s+(?:from\s+now|dessas)\b)`;
export const HOUR_UNIT = String.raw`(h|hs|hrs?|horas?|hours?)`;
export const MINUTE_UNIT = String.raw`(?:min|mins|minutos?|minutes?)`;

/** "2", "1.5", "an", "duas" → horas. */
export function amountOf(raw: string): number {
  const value = raw.replace(/\s+/g, " ");
  if (value === "an" || value === "a") return 1;
  return HOUR_WORDS[value] ?? Number(value.replace(",", "."));
}
