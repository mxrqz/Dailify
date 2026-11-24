import type { CalendarTarget, ProviderId } from "./integrations";
import type { Task } from "./types";

/** `POST /mew/chat`. One call, one credit; the reply lands whole. */
export interface MewRequest {
  text: string;
  timezone: string;
  /** `data:image/jpeg;base64,…`, at most `MEW_IMAGE_MAX` chars. */
  image?: string;
  /** The last turns, oldest first, at most `MEW_HISTORY_MAX`, each text at most `MEW_TEXT_MAX`. */
  history: { from: "me" | "mew"; text: string }[];
  /** The answer to a `permission` block: the same turn re-sent, now allowed to read. */
  permission?: { id: string; always: boolean };
}

export const MEW_TEXT_MAX = 500;
export const MEW_HISTORY_MAX = 8;
export const MEW_IMAGE_MAX = 1_400_000;
/** A confirmed `send` draft, in chars. */
export const MEW_SEND_MAX = 4000;

/** The `error` of the 403 before consent; older app builds compare it, new ones the `code`. */
export const MEW_CONSENT_REQUIRED = "Mew Consent Required";

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
      targets?: CalendarTarget[];
      /** The parent task (steps) or the target day (move), for the box title. */
      label?: string;
    }
  | {
      /** Mew asks to read `target` from a connected app; `id` is the `mew_actions` row. */
      kind: "permission";
      id: string;
      provider: ProviderId;
      capability: MewCapability;
      target: string;
      /** `target` as a person reads it ("#geral"). */
      label: string;
    }
  | {
      /** A message draft for a connected app: always confirmed, never "always allow". */
      kind: "send";
      id: string;
      provider: ProviderId;
      /** The provider's address; the server sends to its own stored copy, never this one. */
      target: string;
      /** The recipient as a person reads it. */
      to: string;
      text: string;
    }
  | ({ kind: "items" } & MewCard);

/** What a read showed, built by the server from the data (never the model). */
export interface MewCard {
  provider: ProviderId;
  /** "GitHub", "#produto", "owner/repo #3". */
  source: string;
  url: string;
  /** Everything the read found; `items` holds at most `MEW_CARD_MAX`. */
  total: number;
  items: MewCardItem[];
  /** One item read by ref (GitHub issue/PR). */
  detail?: MewCardDetail;
}

export const MEW_CARD_MAX = 5;

export interface MewCardItem {
  title: string;
  url: string;
  icon: "issue" | "pr" | "message";
  /** "owner/repo #12". */
  where?: string;
  author?: string;
  at?: number;
  labels?: string[];
  /** A PR waiting for the reader's review. */
  review?: boolean;
  /** The message mentions the reader. */
  mention?: boolean;
  replies?: number;
  /** Already a Mewki task. */
  linked?: boolean;
}

export interface MewCardDetail {
  state: "open" | "closed";
  author: string;
  comments: number;
  body: string;
  recent: { author: string; at: number; text: string }[];
}

/** What an "always" grant covers, per user and provider. Sending never gets one. */
export const MEW_CAPABILITIES = ["read"] as const;
export type MewCapability = (typeof MEW_CAPABILITIES)[number];

export interface MewReply {
  reply: string;
  intent: MewIntent;
  blocks: MewBlock[];
}

/** `POST /mew/transcribe`: the spoken turn, sent next as a normal `/mew/chat` text. */
export interface MewTranscript {
  text: string;
}

export type MewActionStatus = "proposed" | "done" | "cancelled" | "undone";
