import { TZDate } from "@date-fns/tz";
import { type Hit, type Span, hit, spanOf } from "./spans";
import {
  AMOUNT_RE,
  AT_RE,
  CONNECTOR_RE,
  DAY_WORD_RE,
  HOUR_WORDS,
  HOUR_WORD_RE,
  MINUTE_SUFFIX_RE,
  MINUTE_UNIT,
  MINUTE_WORDS,
  MINUTE_WORD_RE,
  PERIOD_HOURS,
  SHORT_MERIDIEM_END,
  WEEKDAY_RE,
  alternation,
  amountOf,
  shortMeridiem,
  startOfDay,
  suffixMinutes,
  zoneOf,
} from "./vocab";

export interface Time {
  hour: number;
  minute: number;
  /** Dias à frente de hoje — só a hora relativa ("em 24 horas") sabe isso sozinha. */
  days?: number;
}

/** Qual dia o texto deu: hoje explícito, nenhum (a hora decide, e pode rolar pra amanhã) ou outro. */
export type Base = "today" | "none" | "other";

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
      String.raw`\b(da|de|a|na|pela|at|in|this)\s+(?:the\s+)?(tarde|noite|afternoon|evening|night)\b|\d\s*p\.?m\b\.?|\bp\.?m\b\.?|${shortMeridiem("p")}|\bton(?:ight|ite)\b|\b2ni(?:gh)?te\b`,
    ),
  );
  const am = text.match(
    new RegExp(
      String.raw`\b(da|de|a|na|pela|at|in|this)\s+(?:the\s+)?(manha|madrugada|morning|dawn)\b|\d\s*a\.?m\b\.?|\ba\.?m\b\.?|${shortMeridiem("a")}`,
    ),
  );
  const period = periodHour(text);

  // "6:30 tomorrow morning": o período sozinho também diz manhã ou tarde.
  const isPM = pm !== null || (am === null && period !== null && period.value >= 12);
  const isAM = am !== null || (pm === null && period !== null && period.value < 12);

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
    [
      /\b(?:n?o\s+)?(?:inicio|comeco)\s+da\s+manha\b|\bearly\s+(?:(?:tomorrow|today)\s+)?morning\b|\b(?:de|da|pela)\s+manha\s+cedo\b|\bcedo\s+de\s+manha\b/,
      7,
    ],
    [/\b(?:depois|dps|apos)\s+do\s+almoco\b|\bafter\s+lunch\b/, 13],
    [
      /\b(?:n?a\s+)?hora\s+do\s+almoco\b|\bno\s+almoco\b|\b(?:at\s+)?lunchtime\b|\bat\s+lunch\b/,
      12,
    ],
    [
      /\b(?:at\s+(?:the\s+)?)?end\s+of\s+(?:the\s+)?day\b|\beod\b|\b(?:ate\s+o\s+)?(?:fim|final)\s+do\s+dia\b/,
      18,
    ],
    // "amanhã cedo" — "dormir cedo" é título.
    [/\bcedinho\b|\bearly(?=\s+tomorrow\b)/, 7],
    [/(?<=\b(?:amanha|hoje)\s+)cedo\b/, 8],
    [
      new RegExp(`(?<=\\b(?:tomorrow|today|${WEEKDAY_RE})\\s+)(?:night|nite)\\b`),
      PERIOD_HOURS.evening,
    ],
    // "Sat am", "tmrw pm": sem número, o am/pm colado no dia é o período.
    [new RegExp(`(?<=\\b(?:${DAY_WORD_RE})\\s+)am\\b`), PERIOD_HOURS.morning],
    [new RegExp(`(?<=\\b(?:${DAY_WORD_RE})\\s+)pm\\b`), PERIOD_HOURS.afternoon],

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

export function parseTime(
  text: string,
  now: Date,
  base: Base,
  literalTime = false,
  /** Falso: só relógio — "à noite" sozinho não conta como outra hora. */
  periods = true,
): Hit<Time> | null {
  // daqui a 2 horas · in 90 minutes · em meia hora · daqui a 1h30 · in an hour and a half — `days`
  // porque "em 24 horas" cai amanhã na mesma hora
  const relative =
    text.match(
      new RegExp(
        `\\b(?:da?qui(?:\\s+a)?|em|in|dentro\\s+de|within)\\s+(?:(meia\\s+hora|half\\s+an?\\s+hour)|(${AMOUNT_RE})\\s*(h|hs|hrs?|horas?|hours?|m|min|mins|minutos?|minutes?)(?![a-z])(?:(\\d{2})(?!\\d)|\\s+(?:e|and)\\s+(?:(meia|a\\s+half)|(\\d{1,2}|${MINUTE_WORD_RE})\\s*${MINUTE_UNIT})\\b)?)`,
      ),
    ) ??
    // half an hour from now · 20 minutes from now
    text.match(
      new RegExp(
        `\\b(?:(meia\\s+hora|half\\s+an?\\s+hour)|(${AMOUNT_RE})\\s*(h|hrs?|hours?|m|min|mins|minutes?))\\s+from\\s+now\\b`,
      ),
    );
  if (relative) {
    const [, half, rawAmount, unit, clockMinutes, andHalf, rawMinutes] = relative;
    const minutes = half
      ? 30
      : /^m/.test(unit)
        ? amountOf(rawAmount)
        : amountOf(rawAmount) * 60 +
          (andHalf ? 30 : clockMinutes ? Number(clockMinutes) : suffixMinutes(rawMinutes));
    const target = new TZDate(now.getTime() + minutes * 60_000, zoneOf(now));
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
      // "at 3:15"/"@ 2:30" é relógio de 12h: segue a hora plausível, como o "às 3" seco.
      const twelveHour = /^(?:at\b|@)/.test(withMinutes[0]) && withMinutes[1].length === 1;
      const meridiem = applyMeridiem({ hour, minute }, text, now, base, literalTime || !twelveHour);
      return hit(withMinutes, meridiem.value, meridiem.spans);
    }
  }

  // 0900 · 1730 — hora militar só com cara de hora (conector ou dia antes; depois, só com o zero na
  // frente — "assistir 1917 hoje" é filme): "0800" solto é telefone.
  const military = text.match(
    new RegExp(
      `${AT_RE}\\b([01]\\d|2[0-3])([0-5]\\d)\\b|(?<=\\b(?:${DAY_WORD_RE})\\s+)\\b([01]\\d|2[0-3])([0-5]\\d)\\b|\\b(0\\d)([0-5]\\d)\\b(?=\\s+(?:${DAY_WORD_RE})\\b)`,
    ),
  );
  if (military) {
    const [hour, minute] = military
      .slice(1)
      .filter((group) => group !== undefined)
      .map(Number);
    return hit(military, { hour, minute });
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
      `${CONNECTOR_RE}\\b(\\d{1,2})\\s*(?:h\\b|hs\\b|hrs?\\b|horas?\\b|o\\s*clock\\b|em\\s+ponto\\b)|${AT_RE}(\\d{1,2})(?:\\b|[ap]\\b)|${CONNECTOR_RE}\\b(\\d{1,2})(?:\\s*[ap]\\.?m\\b|[ap](?=${SHORT_MERIDIEM_END})|[ap]\\b(?<=\\b(?:${DAY_WORD_RE})\\s+\\d{1,2}[ap]))|\\b(\\d{1,2})\\s+(?:da|de|pela|at|in|this)\\s+(?:the\\s+)?(?:manha|tarde|noite|madrugada|morning|afternoon|evening|night)\\b|(?<=\\b(?:${WEEKDAY_RE})\\s+)(\\d{1,2})(?=\\s*$)`,
    ),
  );
  if (wholeHour) {
    const digits = wholeHour.slice(1).find((group) => group !== undefined);
    const hour = Number(digits);
    if (hour <= 24) {
      const clock = /\d\s*(?:h|hs|hrs?|horas?)\b|em\s+ponto/.test(wholeHour[0]);
      const meridiem = applyMeridiem({ hour, minute: 0 }, text, now, base, literalTime || clock);
      return hit(wholeHour, meridiem.value, meridiem.spans);
    }
  }

  // às duas · às duas e meia · at two thirty · duas horas · duas da tarde — sem conector, "uma
  // pizza" e "cinco capítulos" virariam 13h e 17h.
  const spelledTail = `(${HOUR_WORD_RE})\\b(?:\\s+(?:e\\s+)?(${MINUTE_WORD_RE})\\b)?`;
  // "nove e quinze"/"sete e meia" soltos: hora de relógio (1–12) com os minutos de relógio —
  // "vinte e cinco reais" e "um e meio" não casam.
  const clockWords = `(${alternation(Object.keys(HOUR_WORDS).filter((key) => HOUR_WORDS[key] <= 12))})\\s+e\\s+(meia|quinze|trinta|quarenta\\s+e\\s+cinco|dez|vinte|cinco)\\b`;
  const spelled =
    text.match(new RegExp(`${AT_RE}${spelledTail}(?:\\s+(?:horas?|o\\s*clock)\\b)?`)) ??
    text.match(
      new RegExp(`\\b${clockWords}(?!\\s+(?:horas?|hours?|minutos?|minutes?|anos?|years?)\\b)`),
    ) ??
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
  if (!periods) return null;
  const period = periodHour(text);
  return period === null ? null : { value: { hour: period.value, minute: 0 }, spans: period.spans };
}
