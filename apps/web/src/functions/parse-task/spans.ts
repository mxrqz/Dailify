export type Span = [number, number];

/** Valor + os trechos do texto que o produziram. `spans` vazio = veio de lugar nenhum. */
export interface Hit<T> {
  value: T;
  spans: Span[];
}

/** O span de um `String.match`. */
export function spanOf(match: RegExpMatchArray): Span {
  const start = match.index ?? 0;
  return [start, start + match[0].length];
}

/** Embrulha o resultado de um `String.match` com o span dele. */
export function hit<T>(match: RegExpMatchArray, value: T, extra: Span[] = []): Hit<T> {
  return { value, spans: [spanOf(match), ...extra] };
}

/**
 * Une spans que se sobrepõem ou se encostam — "at 9" e "9 pm" batem em detectores diferentes e
 * dividem o "9"; escolher um deixaria o pedaço exclusivo do outro ("pm") no título.
 * A saída **disjunta e ordenada** é contrato: `cut()` anda `pos` só pra frente e duplicaria texto
 * com spans sobrepostos.
 */
export function mergeSpans(spans: Span[]): Span[] {
  const merged: Span[] = [];
  for (const [start, end] of [...spans].sort((a, b) => a[0] - b[0])) {
    const last = merged.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

/** Troca os trechos por espaço em vez de apagá-los: remover deslocaria todos os índices seguintes. */
export const mask = (text: string, spans: Span[]) =>
  text
    .split("")
    .map((char, i) => (spans.some(([s, e]) => i >= s && i < e) ? " " : char))
    .join("");
