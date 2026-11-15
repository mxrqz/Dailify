import { zoned } from "../zone";
import { type Span, mask, spanOf } from "./spans";
import { parseTime } from "./times";
import {
  DAY_WORD_RE,
  HOUR_UNIT,
  HOUR_WORD_RE,
  MINUTE_UNIT,
  MINUTE_WORDS,
  MINUTE_WORD_RE,
  MONTH_RE,
  NOT_FROM_NOW,
  amountOf,
  suffixMinutes,
} from "./vocab";

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
const MEETING_RE =
  /\b(?:reuniao|meeting|call|aula|consulta|entrevista|plantao|turno|expediente|shift)\b/;

const RANGE_RE = new RegExp(
  String.raw`(?<![/:.,])\b(?:(das|da|do|de|from|between|entre)\s+)?(${CLOCK})(\s+(?:(as|ao|a|ate|to|until|till|e|and)\s+)?)(${CLOCK})(?![\d/:])`,
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
        (!bare || (a.hour <= 12 && b.hour <= 12));
    } else if (word === "e" || word === "and") {
      ok = prefix === "entre" || prefix === "between";
    } else if (!prefix) {
      // "9 to 5 monday": seco, só com dia ou compromisso na frase — "pages 3 to 5" é contagem.
      ok =
        (a.marked && b.marked) ||
        (["to", "as"].includes(word) &&
          a.hour <= 12 &&
          b.hour <= 12 &&
          (MEETING_RE.test(text) || new RegExp(`\\b(?:${DAY_WORD_RE})\\b`).test(text)));
    } else {
      // Sem marca, "ate" e "de N a M" são contagem ("das 5 até 10", "páginas de 15 a 20").
      ok =
        !bare ||
        ["as", "ao", "to", "until", "till"].includes(word) ||
        (word === "a" && (prefix !== "de" || MEETING_RE.test(text)));
    }
    // "de 13 a 15 de dezembro" é intervalo de dias, não de horas; "dec 3 às 10h" é dia e hora.
    if (
      !ok ||
      new RegExp(`\\b(?:${MONTH_RE})\\.?\\s*$`).test(text.slice(0, index)) ||
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
    } else if (!a.meridiem && !b.meridiem && b.hour < 12 && end < start && end + 12 > start) {
      // "12:30–1:30" é relógio de 12h, não virada de meia-noite.
      end += 12;
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
const LASTS = String.raw`((?:de|por|durante|dura|for|lasting|lasts|com\s+duracao\s+de)\s+)?`;
// "daqui a 2 horas"/"in 30 min" é hora relativa; "às 2 horas" é hora; "a cada 2 horas" é série.
const NOT_DURATION = String.raw`(?<!\b(?:da?qui(?:\s+a)?|em|in|dentro|de|as|das|pelas|at|ate|every|cada|half|meia)\s*)(?<![:.,])`;

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
    new RegExp(`${NOT_DURATION}\\b${LASTS}(?:meia\\s+hora|half\\s+an?\\s+hour)\\b${NOT_FROM_NOW}`),
  );
  if (half) return found(half, 30);

  // 2h · 2 horas · uma hora e meia · 1h30 · 1 hora e 30 minutos · 1 hr 30 min · 1.5 hours
  const allHours = [
    ...text.matchAll(
      new RegExp(
        `${NOT_DURATION}\\b${LASTS}(\\d{1,3}(?:[.,]\\d)?|an|${HOUR_WORD_RE})\\s*${HOUR_UNIT}(?![a-z])(?!\\s*[ap]\\.?m\\b|\\s+(?:da|de|pela)\\s+(?:manha|tarde|noite|madrugada)\\b)(?:\\s*(?:e|and)\\s+(meia|a\\s+half)\\b|\\s*(?:(?:e|and)\\s+)?(\\d{1,2}|${MINUTE_WORD_RE})\\s*(?:${MINUTE_UNIT}|m)?\\b)?${NOT_FROM_NOW}`,
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
    // "vinte e duas horas" é hora; "vinte e quatro horas", duração.
    const spelled = !/^\d/.test(rawAmount) && (amount < 13 || amount > 23);

    const implausible = (amount >= 1 && amount <= 4) || amount >= 24;
    // "estudar 1h hoje", "1h30 review on wed": o dia logo depois, ou os minutos colados, também fecham.
    const atEnd =
      !/^hs?$/.test(unit) ||
      andHalf !== undefined ||
      rawMinutes !== undefined ||
      new RegExp(`^(?:[\\s,.;!?]*$|\\s+(?:${DAY_WORD_RE}|on|every)\\b)`).test(
        text.slice((hours.index ?? 0) + whole.length),
      );
    const otherTime = () =>
      parseTime(mask(text, [spanOf(hours)]), zoned(), "other", false, false) !== null;
    if (prefix || spelled || (implausible && atEnd) || otherTime()) {
      const extra = andHalf ? 30 : suffixMinutes(rawMinutes);
      const result = found(hours, Math.round(amount * 60) + extra);
      if (result) return result;
    }
  }

  // 10 min · 30 minutos · quarenta minutos · 90 minutes
  const minutes = text.match(
    new RegExp(
      `${NOT_DURATION}(?<!\\b(?:horas?|hours?)\\s+(?:e|and)\\s+)\\b${LASTS}(?:(\\d{1,3}|${MINUTE_WORD_RE})\\s*${MINUTE_UNIT}|(?<!\\b(?:de|of)\\s+)(\\d{1,3})m(?!\\s+(?:de|of)\\b))\\b${NOT_FROM_NOW}`,
    ),
  );
  if (minutes) {
    // "nap 20m": o "m" colado no número também é minuto — "cabo de 2m" e "5m de cabo" são metro.
    const raw = (minutes[2] ?? minutes[3]).replace(/\s+/g, " ");
    return found(minutes, /^\d+$/.test(raw) ? Number(raw) : (MINUTE_WORDS[raw] ?? 0));
  }

  return null;
}
