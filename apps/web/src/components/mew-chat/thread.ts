import type { MewBlock, MewIntent, MewReply, Task } from "@dailify/shared";

import { chatKey } from "@/functions/offline";

/** `draft` → `done` → `undone`, or `draft` → `cancelled`. */
export type Step = "draft" | "done" | "cancelled" | "undone";

/** A server confirm box plus what only the device knows: where it is and which rows are unchecked. */
export type ConfirmBlock = Extract<MewBlock, { kind: "confirm" }> & { step: Step; off: string[] };
/** `done` = allowed (the turn was re-sent), `cancelled` = denied. */
export type PermissionBlock = Extract<MewBlock, { kind: "permission" }> & { step: Step };
/** `text` is the draft as the person edited it; `done` = sent. */
export type SendBlock = Extract<MewBlock, { kind: "send" }> & { step: Step };
export type Block =
  Extract<MewBlock, { kind: "tasks" }> | ConfirmBlock | PermissionBlock | SendBlock;
/** A block the person answers: it has an id and a step. */
export type BoxBlock = Exclude<Block, { kind: "tasks" }>;

export type Message =
  | { id: string; from: "me"; text: string; image?: string }
  | {
      id: string;
      from: "mew";
      text: string;
      typing: boolean;
      intent?: MewIntent;
      blocks: Block[];
    };

export type ChatAction =
  | { type: "send"; id: string; text: string; image?: string }
  | { type: "reply"; to: string; reply: MewReply }
  /** Takes back a send the server refused before answering (no consent). */
  | { type: "drop"; id: string }
  /** Replaces the draft with the same id: its inline title or the whole task from the editor. */
  | { type: "edit"; block: string; task: Task }
  | { type: "toggle"; block: string; task: string }
  | { type: "confirm" | "cancel" | "undo"; block: string }
  /** A permission box answered yes; `mew-chat.tsx` re-sends the turn with it. */
  | { type: "allow"; block: string; always: boolean }
  /** The Mew's continuation after an allow: a typing reply with no new message of mine. */
  | { type: "wait"; id: string }
  /** A send box: its edited text, then the confirmed send. */
  | { type: "draft"; block: string; text: string }
  | { type: "deliver"; block: string }
  /** Rollback when the writes behind a confirm or undo failed. */
  | { type: "settle"; block: string; step: Step }
  | { type: "clear" };

export const mewId = (sendId: string) => `${sendId}-mew`;

/** What a confirm writes: the checked rows with a title, frozen so undo reverts exactly that. */
export const frozen = (block: ConfirmBlock): ConfirmBlock => ({
  ...block,
  after: block.after.filter((x) => !block.off.includes(x.id) && x.title.trim()),
  off: [],
});

const mapBox = (messages: Message[], id: string, fn: (block: BoxBlock) => BoxBlock): Message[] =>
  messages.map((m) =>
    m.from === "mew"
      ? { ...m, blocks: m.blocks.map((b) => (b.kind !== "tasks" && b.id === id ? fn(b) : b)) }
      : m,
  );

const mapConfirm = (
  messages: Message[],
  id: string,
  fn: (block: ConfirmBlock) => ConfirmBlock,
): Message[] => mapBox(messages, id, (b) => (b.kind === "confirm" ? fn(b) : b));

const from = (step: Step, to: Step) => (b: BoxBlock) => (b.step === step ? { ...b, step: to } : b);

export function chatReducer(messages: Message[], action: ChatAction): Message[] {
  switch (action.type) {
    case "send":
      return [
        ...messages,
        { id: action.id, from: "me", text: action.text, image: action.image },
        { id: mewId(action.id), from: "mew", text: "", typing: true, blocks: [] },
      ];
    case "reply":
      return messages.map((m) =>
        m.id === action.to && m.from === "mew"
          ? {
              ...m,
              typing: false,
              text: action.reply.reply,
              intent: action.reply.intent,
              blocks: action.reply.blocks.map((b): Block =>
                b.kind === "confirm"
                  ? { ...b, step: "draft", off: [] }
                  : b.kind === "tasks"
                    ? b
                    : { ...b, step: "draft" },
              ),
            }
          : m,
      );
    case "drop":
      return messages.filter((m) => m.id !== action.id && m.id !== mewId(action.id));
    case "edit":
      return mapConfirm(messages, action.block, (b) => ({
        ...b,
        after: b.after.map((x) => (x.id === action.task.id ? action.task : x)),
      }));
    case "toggle":
      return mapConfirm(messages, action.block, (b) => ({
        ...b,
        off: b.off.includes(action.task)
          ? b.off.filter((id) => id !== action.task)
          : [...b.off, action.task],
      }));
    case "confirm":
      return mapConfirm(messages, action.block, (b) =>
        b.step === "draft" ? { ...frozen(b), step: "done" } : b,
      );
    case "cancel":
      return mapBox(messages, action.block, from("draft", "cancelled"));
    case "undo":
      return mapConfirm(messages, action.block, (b) =>
        b.step === "done" ? { ...b, step: "undone" } : b,
      );
    case "allow":
    case "deliver":
      return mapBox(messages, action.block, from("draft", "done"));
    case "wait":
      return [
        ...messages,
        { id: mewId(action.id), from: "mew", text: "", typing: true, blocks: [] },
      ];
    case "draft":
      return mapBox(messages, action.block, (b) =>
        b.kind === "send" ? { ...b, text: action.text } : b,
      );
    case "settle":
      return mapBox(messages, action.block, (b) => ({ ...b, step: action.step }));
    case "clear":
      return [];
  }
}

const KEEP = 50;

const isMessages = (value: unknown): value is Message[] => Array.isArray(value);

/** A reload mid-request leaves a reply typing forever: drop it. */
export function loadChat(userId: string | undefined): Message[] {
  if (!userId) return [];
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(chatKey(userId)) ?? "null");
    return isMessages(raw) ? raw.filter((m) => !(m.from === "mew" && m.typing)) : [];
  } catch {
    return [];
  }
}

export function saveChat(userId: string, messages: Message[]): void {
  try {
    localStorage.setItem(chatKey(userId), JSON.stringify(messages.slice(-KEEP)));
  } catch {
    // Quota or private mode: the chat just stops remembering.
  }
}
