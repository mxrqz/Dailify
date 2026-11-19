import { useSyncExternalStore } from "react";

// Out of the context: the chat, the composer's Mew and the voice hook open it, and AppLayout draws it.
let open = false;
const listeners = new Set<() => void>();

export function setCreditsTray(next: boolean): void {
  open = next;
  listeners.forEach((l) => l());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Whether the "AI credits ran out" tray is up. */
export const useCreditsTray = (): boolean => useSyncExternalStore(subscribe, () => open);
