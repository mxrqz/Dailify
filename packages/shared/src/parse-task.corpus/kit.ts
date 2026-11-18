import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { parseTaskText, type UnsureCode } from "../parse-task";
import { normalize } from "../parse-task/vocab";
import { weekDays } from "../recurrence";
import type { Repeat } from "../types";

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
/** Frases que o parser deve marcar como `unsure` (caminho da IA) em vez de parsear com confiança. */
export type OutOfScope =
  "multi-task" | "question" | "command" | "recurrence" | "alert" | "vague" | "integration";

/** O motivo que cada `outOfScope` cobra quando a linha não diz outro. */
const OUT_OF_SCOPE_CODE: Record<OutOfScope, UnsureCode> = {
  "multi-task": "multi",
  question: "question",
  command: "command",
  recurrence: "repeat-unsupported",
  alert: "alert",
  vague: "vague",
  integration: "integration",
};

export interface Expect {
  title: string;
  day: string | null;
  time: string | null;
  duration: string | null;
  repeat: Repeat;
  /** `repeatEvery`; 1 = ausente. */
  every: number;
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
  /** Motivos que o parser tem que dar (pode dar outros). Com algum, os campos não contam — a IA
   * conserta; sem nenhum (o padrão fora de `outOfScope`), a frase tem que sair sem dúvida. */
  unsure?: UnsureCode[];
  note?: string;
  /** Do holdout cego (`holdout-*.ts`): escrito sem olhar o parser, pontuado à parte. */
  holdout?: boolean;
}

type More = Partial<Pick<Expect, "duration" | "repeat" | "every" | "links">> &
  Pick<CorpusEntry, "now" | "alt" | "outOfScope" | "unsure" | "note">;
export type Row = [
  input: string,
  title: string,
  day?: string | null,
  time?: string | null,
  more?: More,
];

export function section(lang: Lang, category: Category, rows: Row[]): CorpusEntry[] {
  return rows.map(([input, title, day = null, time = null, more = {}]) => {
    const { duration = null, repeat = "Off", every = 1, links = [], ...rest } = more;
    return {
      input,
      expect: { title, day, time, duration, repeat, every, links },
      tags: { category, lang },
      ...rest,
    };
  });
}

export const DEFAULT_NOW = "2026-11-15 14:00";
// Fuso fixo, explícito no `now`: o resultado não depende do fuso da máquina (TZ=UTC ou Tóquio).
export const CORPUS_ZONE = "America/Sao_Paulo";

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

function nowOf(entry: CorpusEntry): TZDate {
  const [date, clock] = (entry.now ?? DEFAULT_NOW).split(" ");
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = clock.split(":").map(Number);
  return new TZDate(y, m - 1, d, h, min, 0, 0, CORPUS_ZONE);
}

export type Actual = Expect & { unsure: UnsureCode[] };

export function actualOf(entry: CorpusEntry): Actual {
  const parsed = parseTaskText(entry.input, nowOf(entry));
  const date = parsed.date ? new TZDate(+parsed.date, CORPUS_ZONE) : null;
  return {
    title: parsed.text,
    day: date ? format(date, "yyyy-MM-dd") : null,
    time: date && parsed.hasTime ? format(date, "HH:mm") : null,
    duration: parsed.duration,
    repeat: parsed.repeat,
    every: parsed.repeatEvery ?? 1,
    links: parsed.links,
    unsure: parsed.unsure.map(({ code }) => code),
  };
}

export const expectedUnsure = (entry: CorpusEntry): UnsureCode[] =>
  entry.unsure ?? (entry.outOfScope ? [OUT_OF_SCOPE_CODE[entry.outOfScope]] : []);

const FIELDS = ["title", "day", "time", "duration", "repeat", "every", "links"] as const;

function mismatches(expect: Expect, actual: Expect): (keyof Expect)[] {
  const ok: Record<keyof Expect, boolean> = {
    title: looseTitle(expect.title) === looseTitle(actual.title),
    day: expect.day === actual.day,
    time: expect.time === actual.time,
    duration: expect.duration === actual.duration,
    repeat: sameRepeat(expect.repeat, actual.repeat),
    every: expect.every === actual.every,
    links: JSON.stringify(expect.links) === JSON.stringify(actual.links),
  };
  return FIELDS.filter((field) => !ok[field]);
}

/**
 * O que falhou; vazio = passou. Com `unsure` esperado, só os motivos contam (falta algum = "unsure").
 * Sem, contam os campos contra a leitura principal (vazio quando ela ou alguma `alt` bate) — e,
 * com os campos certos, qualquer motivo é alarme falso ("unsure"). `wrong`: os campos errados,
 * sempre, pra medir quanto erro o `unsure` avisa.
 */
export function evaluate(entry: CorpusEntry): {
  actual: Actual;
  failed: (keyof Expect | "unsure")[];
  wrong: (keyof Expect)[];
} {
  const actual = actualOf(entry);
  const readings = [entry.expect, ...(entry.alt ?? []).map((alt) => ({ ...entry.expect, ...alt }))];
  const passes = readings.some((reading) => mismatches(reading, actual).length === 0);
  const wrong = passes ? [] : mismatches(entry.expect, actual);
  const want = expectedUnsure(entry);
  if (want.length) {
    const flagged = want.every((code) => actual.unsure.includes(code));
    return { actual, wrong, failed: flagged ? [] : ["unsure"] };
  }
  return { actual, wrong, failed: wrong.length ? wrong : actual.unsure.length ? ["unsure"] : [] };
}
