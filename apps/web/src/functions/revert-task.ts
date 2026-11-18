import type { Task } from "@dailify/shared";

/**
 * Rolls `id` back to its entries in `previous` and keeps the rest of `current`: a rollback or an
 * Undo that reset the whole list would revert every write that landed since `previous` was read.
 */
export const revertTask = (current: Task[], previous: Task[], id: string): Task[] => [
  ...current.filter((t) => t.id !== id),
  ...previous.filter((t) => t.id === id),
];
