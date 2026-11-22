// The `useMediaQuery` queries; the widths are Tailwind's `sm`/`md` breakpoints.

/** Tailwind `md` and up. */
export const DESKTOP = "(min-width: 768px)";
/** Below Tailwind `md`. */
export const MOBILE = "(max-width: 767px)";

/** Arrastar é do mouse: no toque a linha já desliza (swipe) e segue só com a folha de edição. */
export const NO_DRAG = `${MOBILE}, (pointer: coarse)`;

/** A finger, not a mouse: Enter breaks a line in the Mew input, the button sends. */
export const TOUCH = "(pointer: coarse)";
