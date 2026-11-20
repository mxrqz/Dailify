import { useSyncExternalStore } from "react";

/** What the desktop side panel shows; `day` is an epoch-ms instant (the day's start). */
export type PanelState =
  { kind: "task"; id: string; day?: number } | { kind: "mew" } | { kind: "day"; day: number };

// A module store, not context: the sidebar, the toolbar and the agenda rows all open it, and a
// change must not re-render every DailifyContext consumer.
let current: PanelState | null = null;
const listeners = new Set<() => void>();

function set(next: PanelState | null): void {
  current = next;
  listeners.forEach((l) => l());
}

export const openPanel = (state: PanelState): void => set(state);
export const closePanel = (): void => set(null);
/** The toolbar button: closes whatever is open, or opens the Mew. */
export const togglePanel = (): void => set(current ? null : { kind: "mew" });

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function usePanel(): PanelState | null {
  return useSyncExternalStore(subscribe, () => current);
}
