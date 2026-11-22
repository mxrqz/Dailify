/** The mobile app bar's content height (`h-bar`, without the safe area). */
const BAR_PX = 52;
// A week pill (`h-13`) and the strip's top padding (`py-2`).
const PILL_PX = 52;
const PAD_PX = 8;

/** How far the week strip has docked over the bar: 0 in the flow, 1 once stuck at its top. */
export function dockProgress(stripTop: number, barBottom: number): number {
  return Math.min(1, Math.max(0, (barBottom - stripTop) / BAR_PX));
}

/**
 * The week's transform at progress `p` (origin top left): from its place in the flow to the bar,
 * scaled into `slot` (right of the menu) with the pills centered on the bar.
 */
export function dockTransform(
  p: number,
  box: { left: number; width: number },
  slot: { left: number; right: number },
): string {
  const s = (slot.right - slot.left) / box.width;
  const dx = p * (slot.left - box.left);
  const dy = p * (BAR_PX / 2 - PAD_PX - (PILL_PX / 2) * s);
  return `translate(${dx}px, ${dy}px) scale(${1 - p * (1 - s)})`;
}
