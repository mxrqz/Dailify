import type { TZDate } from "@date-fns/tz";
import { TASK_LIMITS } from "../limits";
import { parseLinks } from "../parse-links";
import type { ParsedTaskWire } from "../types";
import { parseDuration } from "./durations";
import {
  BOUNDED_REPEAT_RE,
  UNSUPPORTED_REPEAT_RE,
  nextOccurrence,
  parseInterval,
  parseRepeat,
  weekly,
} from "./repeat";
import { type Span, mask, mergeSpans, spanOf } from "./spans";
import { cut, properNouns } from "./title";
import { type Unsure, unsureOf } from "./unsure";
import { WEEKDAY_RE, normalize, startOfDay } from "./vocab";
import { parseWhen } from "./when";

/**
 * `parseTaskText` é a porta de entrada: recebe a frase inteira do composer ("reunião com o time
 * das 15 às 16 meet.google.com/abc") e devolve título, data, duração e links — sem LLM:
 * normalização + tabelas + regex. Cada detector (link, duração, dia, hora) procura o seu pedaço
 * independentemente dos outros, então pt-BR e inglês podem vir misturados na mesma frase, e o que
 * cada um consumiu é recortado do título pelos spans que devolve.
 *
 * `parseWhen`/`parseDuration` são os detectores por baixo (o teste importa do módulo). `parseWhen`
 * devolve `null` quando não reconhece nada e `hasTime: false` quando só achou o dia, pra quem
 * chama decidir o horário padrão.
 *
 * Um módulo por detector: `times` (hora), `dates` (dia), `when` (os dois juntos), `durations`
 * (duração e intervalo), `repeat` (série), `title` (recorte e nomes próprios), `unsure` (por que a
 * leitura pode estar errada); `vocab` e `spans` são as tabelas e o encanamento que todos dividem.
 */

export { type Span, remapSpans } from "./spans";
export { type Unsure, type UnsureCode } from "./unsure";

export type Field = "day" | "time" | "duration" | "repeat" | "links" | "tags";

/** Mesmo formato que a IA devolve (`ParsedTaskWire`), com a data como `Date` e os motivos de dúvida. */
export interface ParsedTask extends Omit<ParsedTaskWire, "date"> {
  date: Date | null;
  /** `#word` tags, deduplicated case-insensitively, at most `TASK_LIMITS.tagsMax`. */
  tags: string[];
  /** Por que a leitura pode estar errada; vazio = confiante. */
  unsure: Unsure[];
  /** Os trechos do input que deram cada campo; vazio = não veio do texto (IA, calendário, edição). */
  fields: Record<Field, Span[]>;
}

// Entre aspas duplas é literal: nunca parseado, e as aspas saem do título.
const QUOTED_RE = /"([^"\n]+)"|“([^”\n]+)”/g;

export const quotedSpans = (input: string): Span[] => [...input.matchAll(QUOTED_RE)].map(spanOf);

// A tag starts after a space and with a letter: "#" alone, "PR #23" and a link's "/#anchor" stay.
const TAG_RE = new RegExp(
  `(?<!\\S)#(\\p{L}[\\p{L}\\p{N}_-]{0,${TASK_LIMITS.tagMax - 1}})(?![\\p{L}\\p{N}_-])`,
  "gu",
);

function parseTags(text: string): { tags: string[]; spans: Span[] } {
  const tags: string[] = [];
  const spans: Span[] = [];
  for (const match of text.matchAll(TAG_RE)) {
    const tag = match[1];
    const seen = tags.some((t) => t.toLocaleLowerCase() === tag.toLocaleLowerCase());
    if (!seen && tags.length === TASK_LIMITS.tagsMax) continue;
    if (!seen) tags.push(tag);
    spans.push(spanOf(match));
  }
  return { tags, spans };
}

/** `ignore`: trechos que ficam no título como texto e fora da vista dos detectores. */
export function parseTaskText(
  input: string,
  now: TZDate,
  { ignore = [] }: { ignore?: Span[] } = {},
): ParsedTask {
  const keep = [...ignore, ...quotedSpans(input)];
  const normalized = normalize(input);
  const open = mask(input, keep);
  const links = parseLinks(open);
  const tags = parseTags(mask(open, links.spans));
  // "lembrete: pagar luz amanhã": o rótulo de abertura sai do título junto com os links.
  const label = open.match(/^\s*(?:lembrete|reminder|todo|to\s*do|tarefa|task)\s*:\s*/i);
  const fixed = [...links.spans, ...tags.spans, ...(label ? [spanOf(label)] : [])];
  const title = unquote(cut(input, fixed));
  const unsupported: ParsedTask = {
    text: title,
    date: null,
    hasTime: false,
    hasDay: false,
    duration: null,
    links: links.urls,
    tags: tags.tags,
    repeat: "Off",
    fields: { day: [], time: [], duration: [], repeat: [], links: links.spans, tags: tags.spans },
    unsure: unsureOf({
      input,
      normalized,
      rest: null,
      visible: normalized,
      title,
      consumed: false,
      date: null,
      hasTime: false,
      repeat: "Off",
      now,
    }),
  };
  // "a cada 2 semanas" cabe (`repeatEvery`); o que sobra de "a cada N" depois dela é que não cabe.
  const interval = parseInterval(mask(normalized, [...fixed, ...keep]), now);
  const intervalSpans = interval?.spans ?? [];
  if (UNSUPPORTED_REPEAT_RE.test(mask(normalized, [...keep, ...intervalSpans]))) return unsupported;

  // "youtu.be/15h30" não pode virar horário nem duração; "Sessão da Tarde" e "Dom Casmurro" também não.
  const forDuration = mask(normalized, [
    ...fixed,
    ...properNouns(input),
    ...keep,
    ...intervalSpans,
  ]);
  let duration = parseDuration(forDuration, input);

  // A duração também sai da vista do parseWhen: o "1h" de "call de 1h hoje às 16h" casa como hora
  // e, por ter o span maior, ganhava do horário de verdade.
  const forWhen = mask(forDuration, duration?.spans ?? []);

  // "toda quarta" sai da vista do parseWhen, que leria "quarta" como dia; "dia 5"/"3 de março"
  // ficam fora do span da recorrência e ele ainda lê. O intervalo manda no horário: "das 15 às 16"
  // começa 15:00, e o parseWhen só põe o dia (ou rola pra amanhã se já passou).
  // "toda segunda e quinta de semanas alternadas": os dias vêm da série comum; o N, do intervalo.
  // "todo dia 10 a cada 2 meses" idem: o "todo" é da mesma série.
  const days = interval && parseRepeat(forWhen, now, input);
  const sameKind =
    days &&
    typeof days.value === typeof interval.value &&
    (typeof days.value === "object" || days.value === interval.value);
  const repeat =
    interval && days && sameKind
      ? { ...days, every: interval.every, spans: [...interval.spans, ...days.spans] }
      : (interval ?? parseRepeat(forWhen, now, input));
  const forDay = mask(forWhen, repeat?.spans ?? []);
  if (repeat && BOUNDED_REPEAT_RE.test(forDay)) return unsupported;

  let when = parseWhen(forDay, now, repeat !== null, duration?.start ?? null);
  if (repeat?.hour !== undefined && !when?.hasTime) {
    when = parseWhen(forDay, now, true, { hour: repeat.hour, minute: 0 });
  }
  // "practice 7 minute workout", "The 4-Hour Workweek": sem data nem hora, o adjetivo "N minute X" é
  // nome; "30 minute call tomorrow at 9am" continua duração.
  const [durationStart, durationEnd] = duration?.spans[0] ?? [0, 0];
  const titleSpans: Span[] = [];
  if (
    !when &&
    !repeat &&
    /^\d{1,3}\s+(?:minute|hour)$/.test(normalized.slice(durationStart, durationEnd)) &&
    /^\s+[a-z]/.test(normalized.slice(durationEnd))
  ) {
    titleSpans.push([durationStart, durationEnd]);
    duration = null;
  }

  const spans = mergeSpans([
    ...fixed,
    ...(duration?.spans ?? []),
    ...(repeat?.spans ?? []),
    ...(when?.spans ?? []),
  ]);

  // "toda quarta" cita dias; "dias úteis" também (seg–sex); "toda semana" não.
  const citesWeekday =
    typeof repeat?.value === "object" &&
    repeat.spans.some(([start, end]) =>
      new RegExp(
        `\\b(?:${WEEKDAY_RE})s?\\b|\\b(?:dias?\\s+uteis?|weekdays?|weekends?|(?:fim|fins|final|finais)\\s+de|durante)\\b`,
      ).test((interval ? normalized : forWhen).slice(start, end)),
    );
  // "biweekly 1:1 tue 10am": a cada N semanas sem dia na série fica no dia da frase, não no de hoje.
  if (interval && typeof repeat?.value === "object" && !citesWeekday && when?.hasDay && when.date) {
    repeat.value = weekly([when.date.getDay()]);
  }

  const hasTime = when?.hasTime ?? false;
  const date = repeat
    ? nextOccurrence(repeat.value, when?.date ?? startOfDay(now), hasTime, now)
    : (when?.date ?? null);

  const text = unquote(cut(input, spans));
  // "seg 8h daily": o advérbio que come o título inteiro é o nome da reunião (a "daily").
  const [repeatStart, repeatEnd] = repeat?.spans[0] ?? [0, 0];
  if (
    !text &&
    repeat &&
    /^(?:daily|weekly|monthly)$/.test(normalized.slice(repeatStart, repeatEnd))
  ) {
    return parseTaskText(input, now, { ignore: [...ignore, ...repeat.spans] });
  }

  const value = repeat?.value ?? "Off";
  return {
    text,
    date,
    hasTime,
    hasDay: Boolean(when?.hasDay) || citesWeekday,
    duration: duration?.duration ?? null,
    links: links.urls,
    tags: tags.tags,
    repeat: value,
    repeatEvery: repeat?.every,
    fields: {
      day: when?.day ?? [],
      time: when?.time ?? [],
      duration: duration?.spans ?? [],
      repeat: repeat?.spans ?? [],
      links: links.spans,
      tags: tags.spans,
    },
    unsure: unsureOf({
      input,
      normalized,
      rest: mask(forDuration, [...spans, ...titleSpans]),
      visible: forDuration,
      title: text,
      consumed: Boolean(when || duration || repeat),
      date,
      hasTime,
      repeat: value,
      now,
    }),
  };
}

const unquote = (title: string) => title.replace(QUOTED_RE, (_, plain, curly) => plain ?? curly);
