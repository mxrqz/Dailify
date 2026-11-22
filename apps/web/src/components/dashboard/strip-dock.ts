/** The mobile app bar's content height (`h-bar`, without the safe area). */
const BAR_PX = 52;
// A week pill (`h-13`) and the strip's top padding (`py-2`).
const PILL_PX = 52;
const PAD_PX = 8;

/** How far the week strip has docked over the bar: 0 in the flow, 1 once stuck at its top. */
export function dockProgress(stripTop: number, barBottom: number): number {
  return Math.min(1, Math.max(0, (barBottom - stripTop) / BAR_PX));
}

/** The week's docked pose (origin top left): scaled into `slot`, right of the menu, pills centered on the bar. */
export function dockPose(
  box: { left: number; width: number },
  slot: { left: number; right: number },
): { x: number; y: number; s: number } {
  const s = (slot.right - slot.left) / box.width;
  return { x: slot.left - box.left, y: BAR_PX / 2 - PAD_PX - (PILL_PX / 2) * s, s };
}
