// The `useMediaQuery` queries; the widths are Tailwind's `sm`/`md` breakpoints.

/** Tailwind `md` and up. */
export const DESKTOP = "(min-width: 768px)";
/** Below Tailwind `md`. */
export const MOBILE = "(max-width: 767px)";

/**
 * Sem hover não há como alcançar a toolbar do cartão nem os chips, então é aí — e só aí — que o
 * cartão inteiro vira um alvo que abre a folha, e a edição no cartão é desligada INTEIRA (título
 * incluído): dois caminhos de edição no toque só dariam campo aberto sem querer. Com hover
 * (desktop) é o inverso — edita-se tudo no cartão e um clique no meio dele não faz nada. O
 * `max-width` cobre a janela estreita com mouse, onde a linha de metadados já está apertada demais
 * pra editar em cima dela.
 */
export const SHEET_EDITING = "(hover: none), (max-width: 639px)";

/** Arrastar é do mouse: no toque a linha já desliza (swipe) e segue só com a folha de edição. */
export const NO_DRAG = `${MOBILE}, (pointer: coarse)`;
