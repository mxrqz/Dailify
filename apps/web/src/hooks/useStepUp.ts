import { useSyncExternalStore } from "react";
import { API_ERROR, isRecord } from "@dailify/shared";

// One step-up at a time: the dialog (`components/auth/step-up-dialog.tsx`, in App) reads this.
let pending: ((verified: boolean) => void) | null = null;
const listeners = new Set<() => void>();
const set = (next: typeof pending) => {
  pending = next;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

/**
 * Runs a sensitive action. When the server answers `mfa_required` (no second factor in the last
 * 10 minutes), it asks for one in the step-up dialog and runs the action again once it passes.
 * Works with Better Auth's `{ data, error }` and with `functions/api.ts`'s `{ error }`.
 */
export async function withStepUp<T extends { error?: unknown }>(run: () => Promise<T>): Promise<T> {
  const first = await run();
  if (!isRecord(first.error) || first.error.code !== API_ERROR.mfaRequired) return first;
  pending?.(false);
  const verified = await new Promise<boolean>((resolve) => set(resolve));
  return verified ? run() : first;
}

/** The dialog's side: whether a step-up is waiting, and how to end it. */
export function useStepUp() {
  const open = useSyncExternalStore(subscribe, () => pending !== null);
  return {
    open,
    finish: (verified: boolean) => {
      pending?.(verified);
      set(null);
    },
  };
}
