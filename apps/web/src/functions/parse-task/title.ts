import { DAY_AFTER_RE } from "./dates";
import { type Span, spanOf } from "./spans";
import { HOUR_WORDS, MINUTE_WORDS, MONTH_RE, WEEKDAYS, WEEKDAY_RE, normalize } from "./vocab";

/** Tira os spans do texto, do fim pro começo — cortar de frente invalidaria os índices seguintes. */
const ORPHAN_PUNCT = /[,;:.!?]/;

// Preposição que só existia pra apontar pro trecho recortado ("reunião NO meet…"). Sem o trecho,
// ela aponta pro nada — perde o referente no fim ou no meio da frase, não importa o que vem depois.
// Vale pro conector do tempo também: "até [sexta]", "essa [sexta]", "consulta dia [23/11]", "on [monday]".
const ORPHAN_PREP =
  /(?:^|\s)(no|na|nos|nas|em|pelo|pela|pelos|pelas|via|pro|pra|com|de|do|da|ate|até|essa|esse|esta|este|nesta|neste|nessa|nesse|dia|ao|à|a|o|the|on|by|this|at|in|until|before|antes|due)$/i;

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
  if (!leftTrimmed && /^(?:de|of)\s/i.test(rightTrimmed))
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

// Em pt dia da semana, mês e período se escrevem em minúscula — com maiúscula no meio da frase é nome
// próprio ("Sessão da Tarde", "Rua 7 de Setembro", "Dom Casmurro", "O Quinze"). Vale igual pros
// "Morning"/"Tonight"/"Tomorrow" e números por extenso do inglês ("Good Morning America").
const CAPITALIZED_NAME_WORDS = new Set([
  ...["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado", "domingos"],

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
  /^(?:na|no|ate|essa|esta|nesta|neste|nessa|proxima|proximo|toda|todo|on|by|this|next|every|each|until)$/;

const PT_FUNCTION_WORDS = new Set(["na", "no", "da", "do", "pra", "pro", "com", "um", "uma"]);

/** Spans dos nomes próprios que têm cara de data ou hora — escondidos dos detectores, mantidos no título. */
export function properNouns(input: string): Span[] {
  const words = [...input.matchAll(/[\p{L}\p{N}]+/gu)].map((match) => {
    const start = match.index ?? 0;
    return {
      key: normalize(match[0]),
      span: [start, start + match[0].length] satisfies Span,
      capital: /^\p{Lu}/u.test(match[0]),
    };
  });
  // Endereço com cara de data ou hora: "rua 7 de Setembro", "1600 Pennsylvania Ave".
  const spans = [
    ...input.matchAll(
      /\bfriday the 13th\b|\bcaf[eé] da manh[aã](?!\p{L})|\b(?:rua|r\.|av\.?|avenida|pra[cç]a|travessa|alameda|largo|estrada|rodovia)\s+\d{1,2}\s+de\s+\p{L}+/giu,
    ),
    ...input.matchAll(
      /\b\d{1,5}\s+(?:\p{Lu}\p{L}*\s+)+(?:Ave|Avenue|St|Street|Rd|Road|Blvd|Boulevard|Lane|Ln|Dr|Drive|Way)\b/gu,
    ),
  ].map(spanOf);
  // Título Em Caixa Alta Ou Tudo Maiúsculo: a maiúscula não diz mais nada.
  if (words.every(({ key, capital }) => capital || !/^[a-z]/.test(key))) return spans;
  words.forEach(({ key, span, capital }, i) => {
    const after = input.slice(span[1]);
    // "watch Wednesday season 2", "read Saturday by Ian McEwan", "na Quinta da Boa Vista",
    // "Friday's party": o dia com maiúscula que abre um nome é título, mesmo depois de "na".
    if (
      capital &&
      i > 0 &&
      key in WEEKDAYS &&
      /^(?:['’]s\b|\s+(?:season|episode|part|by\s+\p{Lu}|d[aeo]s?\s+\p{Lu}))/u.test(after)
    ) {
      spans.push(span);
      return;
    }
    if (!capital || i === 0 || BEFORE_DAY_WORD.test(words[i - 1].key)) return;
    const glued = (j: number) => {
      const other = words[j];
      if (!other || j === 0 || !other.capital || EN_DATE_WORD.test(other.key)) return false;
      const [left, right] = j < i ? [other.span, span] : [span, other.span];
      return /^[\s-]+$/.test(input.slice(left[1], right[0]));
    };
    // "Robinson Crusoe and Friday": dia da semana ligado por "and" a outro nome é nome.
    const joined =
      /^(?:and|e)$/.test(words[i - 1].key) &&
      words[i - 2]?.capital &&
      !EN_DATE_WORD.test(words[i - 2].key) &&
      i - 2 > 0;

    // "assistir Wednesday na Netflix": dia em inglês numa frase em pt, solto, é título.
    const englishInPt =
      key in WEEKDAYS &&
      key.length > 5 &&
      words.some((word) => PT_FUNCTION_WORDS.has(word.key)) &&
      !DAY_AFTER_RE.test(normalize(input.slice(span[1])));
    // "Taylor Swift Dec 12": com o número colado é data, mesmo grudado num nome.
    const dated = /^\s+\d/.test(after);
    if (
      CAPITALIZED_NAME_WORDS.has(key) ||
      (EN_DATE_WORD.test(key) && !dated && (glued(i - 1) || glued(i + 1) || joined || englishInPt))
    ) {
      spans.push(span);
    }
  });
  return spans;
}
