import type { Repeat } from "@dailify/shared";
import { parseDuration } from "./durations";
import { parseRepeat } from "./repeat";
import { type Span, spanOf } from "./spans";
import { parseWhen } from "./when";
import { HOUR_WORD_RE, normalize, startOfDay } from "./vocab";

/**
 * Por que o parser pode ter errado — cada motivo é um gatilho determinístico, não um score. Vazio =
 * confiante. O composer usa isso pra oferecer a IA ("Melhorar com a Mew"), nunca pra chamá-la sozinho:
 * alarme falso custa um botão, motivo que falta custa uma tarefa errada em silêncio.
 */
export type UnsureCode =
  | "question"
  | "command"
  | "multi"
  | "list-values"
  | "repeat-unsupported"
  | "alert"
  | "vague"
  | "ambiguous-number"
  | "ambiguous-word"
  | "leftover"
  | "dangling"
  | "past"
  | "long";

export interface Unsure {
  code: UnsureCode;
  /** Trecho do input que disparou o motivo, quando há um só. */
  span?: Span;
}

export interface UnsureInput {
  input: string;
  normalized: string;
  /** O normalizado com tudo que o parser consumiu (e o que ele guardou de propósito) apagado —
   * o que sobrou no título, alinhado com o input. `null` quando a série não cabe no `Repeat`. */
  rest: string | null;
  /** O normalizado sem links e nomes próprios: o que os detectores de tempo enxergaram. */
  visible: string;
  title: string;
  /** Algum detector de tempo (dia, hora, duração, série) leu alguma coisa. */
  consumed: boolean;
  date: Date | null;
  hasTime: boolean;
  repeat: Repeat;
  now: Date;
}

const EN_MARKER_RE =
  /\b(?:the|my|on|due|by|at|for|with|and|to|of|in|is|tomorrow|today|next|pay|call|buy|return)\b/;

// "o que tenho amanhã", "when is my next meeting": a pergunta se anuncia na primeira palavra — a não
// ser que outra oração venha depois ("quanto custa o conserto — perguntar amanhã").
const QUESTION_LEAD_RE =
  /^\s*(?:o\s+que\s+(?:tenho|eu\s+tenho|tem|falta)|que\s+(?:horas?|dia)\b|qua(?:l|is)\b|quant[ao]s?\b|quando\s+(?:e|eh|vence|tenho|sera|foi|que)\b|onde\s+(?:e|fica)\b|what(?:\s*s|\s+(?:is|are|do|does|did|time|day|have))\b|when\s*(?:s|is|do|does|did|am|are)\b|where\s+(?:is|s|are)\b|which\b|who\s+(?:is|s|are)\b|how\s+(?:much|many|long)\b|(?:do|did|does|have|am|is|are)\s+(?:i|we|there)\b)/;
// "ligar pro João — ele vem?": a interrogação de uma oração depois de travessão/vírgula é do título.
const QUESTION_TAIL_RE = /\?[\s!?.\p{Extended_Pictographic}]*$/u;
const CLAUSE_BREAK_RE = /[—–:;,(]|\s-\s/;

// Verbo de editar/apagar uma tarefa que já existe: o imperativo ("muda", "cancela", "apaga") é
// comando; "cancel"/"delete" só com dia ou "tarefa"; o infinitivo pt ("cancelar a assinatura"), só
// com "tarefa".
const COMMAND_ALWAYS_RE =
  /^\s*(?:(?:por\s+favor|please|pls)\s+)?(?:(?:muda|mude|adia|adie|adiar|remarca|remarque|remarcar|desmarca|desmarque|desmarcar|cancela|cancele|apaga|apague|exclui|exclua|deleta|delete|mova|empurra|transfere|joga|troca|conclui|reschedule|postpone|undo)\b|clear\s+my\b|push\s+(?:back|everything|all|my)\b|(?:marca|marcar|marque)\s+(?:\S+\s+){0,5}como\s+(?:feit|conclu|lid)|mark\s+(?:\S+\s+){0,5}(?:as\s+)?(?:done|complete|read)\b|passa\s+(?:a|o|as|os)\s+.*\b(?:pra|pras|para)\b)/;
const COMMAND_VERB_RE = /^\s*(?:cancel|delete|rename|renomeia)\b/;
const COMMAND_INFINITIVE_RE = /^\s*(?:cancelar|apagar|excluir|deletar)\b/;
const TASK_WORD_RE = /\b(?:tarefas?|tasks?|tudo|everything|lembretes?|reminders?)\b/;
// "tira a reunião da agenda", "remove the call from my calendar".
const OFF_CALENDAR_RE =
  /\b(?:d[aeo]\s+(?:minha\s+)?(?:agenda|calendario|lista)|from\s+(?:my|the)\s+(?:calendar|list|schedule))\b/;
// "move standup to 9:30", "change the dentist to 4pm": mover com o destino sendo o tempo que o
// parser leu. "move the couch to the garage saturday" leva o sofá, não a tarefa.
const MOVE_RE =
  /^\s*(?:(?:por\s+favor|please)\s+)?(?:move|mova|mover|muda|mudar|change|push|passa|transfere|bump)\b/;
const TARGET_RE = /\b(?:pra|pras|para|pro|to|until|ate)\s+$/;

// "comprar pão e ligar pro João": dois verbos de tarefa ligados por "e"/vírgula.
const EN_VERB =
  "buy|call|email|text|send|pay|book|clean|wash|pick|take|get|go|write|read|review|finish|fix|check|schedule|meet|visit|cook|walk|feed|water|print|sign|submit|order|return|drop|bring|prepare|renew|update|file|ask|tell|reply|plan|make|study|watch|run|grab|mail|ship|charge|clear";
const VERB = String.raw`(?:[a-z]+(?:ar|er|ir)|${EN_VERB})`;
// Com objeto entre os dois: "levar e buscar as crianças" é uma tarefa só.
const TWO_VERBS_RE = new RegExp(
  String.raw`^\s*${VERB}\s+[^;]+?(?:,|\s(?:e|and|depois|then))\s+(?:(?:tambem|also|depois|then)\s+)?${VERB}\b`,
);
// "lugar"/"jantar"/"bar" e afins terminam em -ar sem ser verbo de tarefa.
const NOT_VERB_RE =
  /^(?:niver|their|later|chair|hair|pair|fair|air|year|dear|near|lugar|bar|mar|par|colar|altar|polar|solar|lar|mulher|prazer|lazer|hangar|celular|familiar|militar|particular|popular|regular|similar|escolar|titular|auxiliar|exemplar|super|her|over|per|after|under|order|letter|paper|poster|dinner|summer|winter|never|other|either|whether|computer|chapter|server)$/;

// "8h e 20h", "dia 10 e dia 25", "the 10th and 25th": dois valores onde o modelo guarda um.
const VALUE = String.raw`(?:\d{1,2}(?::\d{2})?\s*(?:h\b|hs\b|am\b|pm\b)|\d{1,2}(?:st|nd|rd|th)\b|dias?\s+\d{1,2}\b|the\s+\d{1,2}(?:st|nd|rd|th)\b)`;
const LIST_VALUES_RE = new RegExp(
  String.raw`${VALUE}\s*(?:,|&|\be\b|\band\b)\s*(?:(?:as|at|o|the|dia)\s+)?(?:\d{1,2}(?::\d{2})?\s*(?:h\b|hs\b|am\b|pm\b)|\d{1,2}(?:st|nd|rd|th)\b|\d{1,2}\b)`,
);

// Série que o `Repeat` não guarda (o índice já deixa no título as que o detector forte pega).
const REPEAT_HINT_RE = new RegExp(
  [
    String.raw`\b(?:bi|tri)mestra(?:l|is|lmente)\b|\bsemestra(?:l|is|lmente)\b|\bquinzena(?:l|is|lmente)\b|\bquarterly\b|\bhourly\b|\bbiweekly\b|\bfortnightly\b`,
    String.raw`\bde\s+hora\s+em\s+hora\b|\b(?:semana|dia|mes)\s+sim,?\s+(?:semana|dia|mes)\s+nao\b|\bevery\s+other\b`,
    String.raw`\b(?:a\s+)?cada\s+(?:\d+|${HOUR_WORD_RE})\b|\bevery\s+(?:\d+|${HOUR_WORD_RE})\s+\w+`,
    String.raw`\b(?:tod[ao]s?|cada|every)\s+(?:\S+\s+){0,3}(?:bimestres?|trimestres?|semestres?|quarters?)\b`,
    String.raw`\b(?:\d+\s*[ºª]?|primeiro|segundo|terceiro|quarto|quinto|sexto|decimo)\s+dia\s+util\b|\b(?:ultimo|last)\s+(?:dia|day)\b`,
  ].join("|"),
);

// "me avisa 15 min antes", "remind me a day before": antecedência é o alerta, que o parser não lê.
const ALERT_RE =
  /\b(?:\d{1,3}|um|uma|a|an|one|meia)\s*(?:min(?:uto)?s?|minutes?|h|hrs?|horas?|hours?|dias?|days?|semanas?|weeks?)\s+(?:antes|before|de\s+antecedencia|in\s+advance|ahead)\b(?!\s+de\s+[a-z]+(?:ar|er|ir)\b)|\b(?:the\s+(?:night|day|morning|evening)\s+before|na\s+vespera|n[ao]\s+(?:noite|dia)\s+anterior)\b/;

// Tempo que não é data: "algum dia", "sometime", "depois da reunião", "se chover", "ou depois".
const VAGUE_RE =
  /\b(?:algum\s+dia|alguma\s+hora|qualquer\s+(?:dia|hora|momento)|um\s+dia\s+desses|sometime|someday|some\s+day|whenever|quando\s+(?:eu|ele|ela|a\s+gente|der|puder|chegar|voltar)|when\s+(?:i|we|he|she)\b|se\s+(?:chover|der|puder|sobrar|tiver|eu)|if\s+(?:it|i|we)\b|depois\s+d[ao]s?\s+(?!amanha|almoco|janta|manha)\w+|after\s+(?:the|my|work|school|class)\b|before\s+(?:the|my|winter|summer|spring|fall|christmas)\b|antes\s+d[ao]s?\s+(?!amanha)\w+)/;
const OR_RE = /\b(?:ou|or)\b/;

// Ponto entre dois números ("17.11", "23.11") é data em pt e hora em todo lugar.
const DOTTED_RE = /(?<!(?:versao|version|v|r\$|\$)\s*)(?<![\d.])\b(\d{1,2})\.(\d{2})\b(?![.,]?\d)/;
const MILITARY_RE =
  /(?<!(?:as|at|@|pelas|by|#|apto?|sala|bloco|casa|room|suite|unit|n|no|numero)\s*)(?<![\d.,:/$]|\d\s)\b([01]\d|2[0-3])([0-5]\d)\b(?![.,:/]\d|\s\d)/;
const SPACED_CLOCK_RE =
  /(?<![\d.,:/])\b([01]?\d|2[0-3])\s+([0-5]\d)\b(?!\s*(?:\d|h\b|min|horas?|hours?|[ap]m\b))/;
const SLASHED_RE = /(?<![\d/])\b(\d{1,2})\/(\d{1,2})\b(?!\/)/;

// O que sobrou no título e tem cara de tempo — o detector não leu, ou leu e largou um pedaço.
const LEFTOVER_RE = new RegExp(
  [
    String.raw`\b(?:domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:\s*feira)?s?\b(?!\s+(?:via|chamada|vez|opcao|mao)\b)|\b(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)s?\b`,
    String.raw`\b(?:janeiro|fevereiro|abril|junho|julho|agosto|setembro|outubro|novembro|dezembro|january|february|april|june|july|august|september|october|november|december)\b`,
    String.raw`\b\d{1,3}\s*(?:h|hs|hrs?|horas?|hours?|min|mins|minutos?|minutes?)\b`,
    String.raw`\b(?:cada|every|quinzen\w*|biweekly|que\s+vem|ate\s+(?:o|a)\s+(?:fim|final|dia)|next\s+(?:week|month|year))\b|\bsim\s+\w+\s+nao\b`,
    String.raw`\b(?!24\/7\b)\d{1,2}\/\d{1,2}\b|\b\d{1,2}h\d{0,2}\b|(?<=\b(?:as|at)\s+)\d{1,2}\b`,
  ].join("|"),
);

const LEFTOVER_GLOBAL_RE = new RegExp(LEFTOVER_RE.source, "g");

const DANGLING_END_RE =
  /(?:^|\s)(?:e|ou|and|or|to|pra|para|pro|das|dos|from|for|until|till|after|depois|antes|before|entre|between|ate|as|at|ao|aos)[\s,.;:!?]*$/;
const DANGLING_START_RE = /^\s*(?:e|ou|and|or|to|pra|para|ate|until)\s/;

/** "ontem", "sexta passada", "hoje às 8" às 14h: o dia foi pedido com todas as letras — não é dúvida. */
const ASKED_PAST_RE =
  /\b(?:hoje|hj|today|tonight|this\s+(?:morning|afternoon|evening)|ontem|anteontem|yesterday|passad[ao]|last\s+(?:week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/;

const match = (re: RegExp, text: string) => {
  const found = text.match(re);
  return found ? spanOf(found) : null;
};

export function unsureOf({
  input,
  normalized,
  rest,
  visible,
  title,
  consumed,
  date,
  hasTime,
  repeat,
  now,
}: UnsureInput): Unsure[] {
  const out: Unsure[] = [];
  const flag = (code: UnsureCode, span?: Span | null) => out.push(span ? { code, span } : { code });

  const lead = match(QUESTION_LEAD_RE, normalized);
  const tail = input.match(QUESTION_TAIL_RE);
  if (lead && !CLAUSE_BREAK_RE.test(input)) flag("question", lead);
  else if (tail && !CLAUSE_BREAK_RE.test(input.slice(0, tail.index))) flag("question");

  const read = rest === null ? [] : readStarts(visible, rest);
  const task = TASK_WORD_RE.test(normalized);
  if (
    COMMAND_ALWAYS_RE.test(normalized) ||
    (COMMAND_VERB_RE.test(normalized) && (date || task)) ||
    (COMMAND_INFINITIVE_RE.test(normalized) && task) ||
    OFF_CALENDAR_RE.test(normalized) ||
    (MOVE_RE.test(normalized) && read.some((start) => TARGET_RE.test(visible.slice(0, start))))
  ) {
    flag("command");
  }

  // "entre 14h e 15h" é intervalo, não lista.
  const listed = normalized.match(LIST_VALUES_RE);
  const list =
    listed !== null && !/\b(?:entre|between)\s+$/.test(normalized.slice(0, listed.index));
  const verbs = normalize(title).match(TWO_VERBS_RE);
  const realVerbs =
    verbs &&
    [...verbs[0].matchAll(new RegExp(String.raw`\b${VERB}\b`, "g"))]
      .map(([word]) => word)
      .filter((word) => !NOT_VERB_RE.test(word)).length >= 2;
  if (/[;\n]/.test(input.trim()) || realVerbs) flag("multi");
  else if (rest !== null && !list && twoTimedClauses(visible, rest, input, now)) flag("multi");

  if (list) flag("list-values", spanOf(listed));

  const hint = rest === null ? null : match(REPEAT_HINT_RE, rest);
  if (rest === null || hint) flag("repeat-unsupported", hint);

  const alert = match(ALERT_RE, normalized);
  if (alert) flag("alert", alert);
  const vague = match(VAGUE_RE, rest ?? normalized);
  if (vague) flag("vague", vague);
  else if (rest !== null && consumed && OR_RE.test(rest)) {
    flag("vague", match(OR_RE, rest));
  }

  const number = ambiguousNumber(input, normalized, rest ?? normalized, consumed);
  if (number) flag("ambiguous-number", number);

  const word = rest === null ? null : ambiguousWord(visible, rest);
  if (word) flag("ambiguous-word", word);

  if (rest !== null) {
    const leftover = leftoverIn(rest, input, now);
    if (leftover) flag("leftover", leftover);
    // "reunião amanhã a s 10": o "às" partido deixou a hora sem conector.
    else if (consumed && /\b[a-z]\s+\d{1,2}\s*$/i.test(title)) flag("leftover");
    // Só o corte de tempo deixa conector órfão: "comparar bit.ly/a e forms.gle/b" é o título.
    const timeless = normalized
      .split("")
      .map((char, i) => (visible[i] !== " " && rest[i] === " " ? " " : char))
      .join("")
      .trim();
    const dangles = (text: string) => DANGLING_END_RE.test(text) || DANGLING_START_RE.test(text);
    if (consumed && dangles(title) && dangles(timeless)) flag("dangling");
  }

  if (date && repeat === "Off" && !ASKED_PAST_RE.test(normalized)) {
    if (hasTime ? date < now : date < startOfDay(now)) flag("past");
  }

  if (normalized.split(/\s+/).filter(Boolean).length > 15) flag("long");

  return out.filter(({ code }, i) => out.findIndex((other) => other.code === code) === i);
}

/** Onde começa cada trecho que os detectores de tempo leram. */
function readStarts(visible: string, rest: string): number[] {
  const read = (i: number) => visible[i] !== " " && rest[i] === " ";
  return [...visible].flatMap((_, i) => (read(i) && !read(i - 1) ? [i] : []));
}

/**
 * "pagar luz amanhã e água sexta", "gym 7am, dentist 2pm": mais de uma oração com tempo e palavras
 * próprias. Só corta nos separadores que sobraram — o "e" de "três e meia" foi consumido.
 */
function twoTimedClauses(visible: string, rest: string, input: string, now: Date): boolean {
  const cuts = [...rest.matchAll(/,|\s(?:e|and|mas|but)\s/g)].map((hit) => hit.index ?? 0);
  const bounds = [0, ...cuts, visible.length];
  let timed = 0;
  for (let i = 1; i < bounds.length; i++) {
    const [start, end] = [bounds[i - 1], bounds[i]];
    const left = rest.slice(start, end);
    const consumed = visible.slice(start, end).trim() !== left.trim();
    const words = /[a-z]{3,}/.test(left.replace(/^,|\s(?:e|and|mas|but)\s/, " "));
    if (words && (consumed || leftoverIn(left, input.slice(start, end), now))) timed++;
  }
  return timed >= 2;
}

/** `rest`: a hora militar só é dúvida quando ninguém leu ("1730 PT session"); "tomorrow 0900" leu. */
function ambiguousNumber(
  input: string,
  normalized: string,
  rest: string,
  consumed: boolean,
): Span | null {
  const dotted = normalized.match(DOTTED_RE);
  if (dotted) {
    const [a, b] = [Number(dotted[1]), Number(dotted[2])];
    const asDate = (a <= 31 && b >= 1 && b <= 12) || (a >= 1 && a <= 12 && b <= 31);
    if (asDate && a <= 23 && b < 60) return spanOf(dotted);
  }
  const military = rest.match(MILITARY_RE);
  if (military && !/^(?:19|20)/.test(military[0])) return spanOf(military);
  const spaced = normalized.match(SPACED_CLOCK_RE);
  // "14 30" com espaço de verdade — "2026-12-15" também vira "2026 12 15" no normalize.
  if (spaced && consumed && /^\d+\s+\d+$/.test(input.slice(...spanOf(spaced)))) {
    return spanOf(spaced);
  }
  // 12/1 é 12 de janeiro pro parser (pt) e 1º de dezembro pra quem escreve em inglês.
  const slashed = normalized.match(SLASHED_RE);
  if (slashed && EN_MARKER_RE.test(normalized)) {
    const [a, b] = [Number(slashed[1]), Number(slashed[2])];
    if (a !== b && a <= 12 && b <= 12) return spanOf(slashed);
  }
  return null;
}

// "ter levar o dog" (dia ou "ter que"?) e "nove e quinze" sem "às" (hora ou contagem?): o parser
// leu pela borda da frase ou pelo formato, sem preposição nem unidade — a outra leitura segue de pé.
const OPENING_WEEKDAY_RE = /^\s*(ter|sex|dom|qua|seg|sab)\s+[a-z]{2,}(?:ar|er|ir)\b/;
const BARE_CLOCK_WORDS_RE = new RegExp(
  `(?<!\\b(?:as|at|pelas|das|from|until)\\s+)\\b(?:${HOUR_WORD_RE})\\s+e\\s+(?:meia|quinze|trinta|dez|vinte|cinco)\\b`,
);

function ambiguousWord(visible: string, rest: string): Span | null {
  const read = (i: number) => rest[i] === " " && visible[i] !== " ";
  const opening = visible.match(OPENING_WEEKDAY_RE);
  const start = opening ? opening[0].indexOf(opening[1]) : -1;
  if (opening && read(start)) return [start, start + opening[1].length];
  const clock = visible.match(BARE_CLOCK_WORDS_RE);
  return clock && read(clock.index ?? 0) ? spanOf(clock) : null;
}

const NAMED_DAY_RE = /\b(?:black\s+friday|cyber\s+monday)\b/g;

function leftoverIn(seen: string, input: string, now: Date): Span | null {
  const rest = seen.replace(NAMED_DAY_RE, (name) => " ".repeat(name.length));
  const again =
    parseWhen(rest, now)?.spans[0] ??
    parseDuration(rest, input)?.spans[0] ??
    parseRepeat(rest, now, input)?.spans[0];
  if (again) return again;
  // "call April", "read Tuesdays with Morrie": nome com maiúscula que o parser largou de propósito.
  const found = [...rest.matchAll(LEFTOVER_GLOBAL_RE)].find(
    (hit) => !/^\p{Lu}\p{Ll}/u.test(input.slice(hit.index ?? 0)),
  );
  return found ? spanOf(found) : null;
}
