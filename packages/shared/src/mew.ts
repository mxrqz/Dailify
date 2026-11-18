import type { ProviderId } from "./integrations";
import type { Task } from "./types";

/** `POST /mew/chat`. One call, one credit; the reply lands whole. */
export interface MewRequest {
  text: string;
  timezone: string;
  /** `data:image/jpeg;base64,…`, at most `MEW_IMAGE_MAX` chars. */
  image?: string;
  /** The last turns, oldest first, at most `MEW_HISTORY_MAX`, each text at most `MEW_TEXT_MAX`. */
  history: { from: "me" | "mew"; text: string }[];
}

export const MEW_TEXT_MAX = 500;
export const MEW_HISTORY_MAX = 8;
export const MEW_IMAGE_MAX = 1_400_000;

/** Drives the header Mew: `notFound`/`unsupported` make her confused. */
export type MewIntent = "answer" | "propose" | "notFound" | "unsupported";

export type MewAction = "create" | "move" | "steps" | "event" | "delete";

export type MewBlock =
  | { kind: "tasks"; tasks: Task[] }
  | {
      kind: "confirm";
      /** Server id, also the `mew_actions` row. */
      id: string;
      action: MewAction;
      /** Confirming removes `before` and writes `after` (same ids = update); undo reverses. */
      before: Task[];
      after: Task[];
      /** `event`: the connected app to also put the tasks on. */
      targets?: { provider: ProviderId; meet?: boolean }[];
      /** The parent task (steps) or the target day (move), for the box title. */
      label?: string;
    };

export interface MewReply {
  reply: string;
  intent: MewIntent;
  blocks: MewBlock[];
}

export type MewActionStatus = "proposed" | "done" | "cancelled" | "undone";
