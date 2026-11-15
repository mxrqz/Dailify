import { weekDays, type Repeat } from "@dailify/shared";
import { format } from "date-fns";
import { normalize, parseTaskText } from "../parse-task";
import { zoned, zonedAt } from "../zone";

/**
 * O corpus golden do parser: o que uma pessoa cuidadosa quer, não o que o parser faz hoje. Campo
 * omitido numa linha = "nada" (sem dia, sem hora, sem duração, "Off", sem link) — e é cobrado.
 * Datas em "AAAA-MM-DD", horas em "HH:MM", `now` em "AAAA-MM-DD HH:MM" no fuso de São Paulo.
 */

export type Lang = "pt" | "en" | "mix";
export type Category =
  | "relative-day"
  | "absolute-date"
  | "time"
  | "period"
  | "relative-time"
  | "range"
  | "duration"
  | "recurrence"
  | "deadline"
  | "link"
  | "informal"
  | "past-edge"
  | "trap"
  | "out-of-scope";
/** Frases que a fase 4 deve marcar como `unsure` (caminho da IA) em vez de parsear com confiança. */
export type OutOfScope = "multi-task" | "question" | "command" | "recurrence" | "alert" | "vague";

export interface Expect {
  title: string;
  day: string | null;
  time: string | null;
  duration: string | null;
  repeat: Repeat;
  links: string[];
}

export interface CorpusEntry {
  input: string;
  now?: string;
  expect: Expect;
  /** Leituras alternativas aceitáveis de frase ambígua, sobrepostas ao `expect`. */
  alt?: Partial<Expect>[];
  tags: { category: Category; lang: Lang };
  outOfScope?: OutOfScope;
  note?: string;
  /** Do holdout cego (`holdout-*.ts`): escrito sem olhar o parser, pontuado à parte. */
  holdout?: boolean;
}

type More = Partial<Pick<Expect, "duration" | "repeat" | "links">> &
  Pick<CorpusEntry, "now" | "alt" | "outOfScope" | "note">;
export type Row = [
  input: string,
  title: string,
  day?: string | null,
  time?: string | null,
  more?: More,
];

export function section(lang: Lang, category: Category, rows: Row[]): CorpusEntry[] {
  return rows.map(([input, title, day = null, time = null, more = {}]) => {
    const { duration = null, repeat = "Off", links = [], ...rest } = more;
    return {
      input,
      expect: { title, day, time, duration, repeat, links },
      tags: { category, lang },
      ...rest,
    };
  });
}

export const DEFAULT_NOW = "2026-11-15 14:00";

/** "AAAA-MM-DD" `n` dias depois de `from` (domingo 15/11/2026 por padrão). */
export function plus(n: number, from = "2026-11-15"): string {
  const [y, m, d] = from.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export const TODAY = plus(0),
  MON = plus(1),
  TUE = plus(2),
  WED = plus(3),
  THU = plus(4),
  FRI = plus(5),
  SAT = plus(6),
  SUN2 = plus(7),
  MON2 = plus(8),
  TUE2 = plus(9),
  WED2 = plus(10),
  THU2 = plus(11),
  FRI2 = plus(12),
  SAT2 = plus(13),
  YESTERDAY = plus(-1);

export const W = (...days: string[]): Repeat => ({ Weekly: days });
export const MF = W("Monday", "Tuesday", "Wednesday", "Thursday", "Friday");
export const MS = W("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday");
export const WEEKEND = W("Saturday", "Sunday");

const looseTitle = (s: string) =>
  normalize(s)
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:.!?]+|[\s,;:.!?]+$/g, "");

const sameRepeat = (a: Repeat, b: Repeat) => {
  const key = (r: Repeat) =>
    typeof r === "string"
      ? r
      : [...r.Weekly].sort((x, y) => weekDays.indexOf(x) - weekDays.indexOf(y)).join(",");
  return key(a) === key(b);
};

function nowOf(entry: CorpusEntry): Date {
  const [date, clock] = (entry.now ?? DEFAULT_NOW).split(" ");
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = clock.split(":").map(Number);
  return zonedAt(y, m - 1, d, h, min);
}

export function actualOf(entry: CorpusEntry): Expect {
  const parsed = parseTaskText(entry.input, nowOf(entry));
  const date = parsed.date ? zoned(parsed.date) : null;
  return {
    title: parsed.text,
    day: date ? format(date, "yyyy-MM-dd") : null,
    time: date && parsed.hasTime ? format(date, "HH:mm") : null,
    duration: parsed.duration,
    repeat: parsed.repeat,
    links: parsed.links,
  };
}

const FIELDS = ["title", "day", "time", "duration", "repeat", "links"] as const;

function mismatches(expect: Expect, actual: Expect): (keyof Expect)[] {
  const ok: Record<keyof Expect, boolean> = {
    title: looseTitle(expect.title) === looseTitle(actual.title),
    day: expect.day === actual.day,
    time: expect.time === actual.time,
    duration: expect.duration === actual.duration,
    repeat: sameRepeat(expect.repeat, actual.repeat),
    links: JSON.stringify(expect.links) === JSON.stringify(actual.links),
  };
  return FIELDS.filter((field) => !ok[field]);
}

/** Campos errados contra a leitura principal; vazio quando ela ou alguma `alt` bate inteira. */
export function evaluate(entry: CorpusEntry): { actual: Expect; failed: (keyof Expect)[] } {
  const actual = actualOf(entry);
  const readings = [entry.expect, ...(entry.alt ?? []).map((alt) => ({ ...entry.expect, ...alt }))];
  const passes = readings.some((reading) => mismatches(reading, actual).length === 0);
  return { actual, failed: passes ? [] : mismatches(entry.expect, actual) };
}
