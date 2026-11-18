import type { MewBlock, MewIntent, MewReply } from "@dailify/shared";

/** `draft` → `done` → `undone`, or `draft` → `cancelled`. */
export type Step = "draft" | "done" | "cancelled" | "undone";

/** A server confirm box plus what only the device knows: where it is and which rows are unchecked. */
export type ConfirmBlock = Extract<MewBlock, { kind: "confirm" }> & { step: Step; off: string[] };
export type Block = Extract<MewBlock, { kind: "tasks" }> | ConfirmBlock;

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
  | { type: "edit"; block: string; task: string; title: string }
  | { type: "toggle"; block: string; task: string }
  | { type: "confirm" | "cancel" | "undo"; block: string }
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

const mapConfirm = (
  messages: Message[],
  id: string,
  fn: (block: ConfirmBlock) => ConfirmBlock,
): Message[] =>
  messages.map((m) =>
    m.from === "mew"
      ? { ...m, blocks: m.blocks.map((b) => (b.kind === "confirm" && b.id === id ? fn(b) : b)) }
      : m,
  );

const from = (step: Step, to: Step) => (b: ConfirmBlock) =>
  b.step === step ? { ...b, step: to } : b;

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
              blocks: action.reply.blocks.map((b) =>
                b.kind === "confirm" ? { ...b, step: "draft", off: [] } : b,
              ),
            }
          : m,
      );
    case "drop":
      return messages.filter((m) => m.id !== action.id && m.id !== mewId(action.id));
    case "edit":
      return mapConfirm(messages, action.block, (b) => ({
        ...b,
        after: b.after.map((x) => (x.id === action.task ? { ...x, title: action.title } : x)),
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
      return mapConfirm(messages, action.block, from("draft", "cancelled"));
    case "undo":
      return mapConfirm(messages, action.block, from("done", "undone"));
    case "settle":
      return mapConfirm(messages, action.block, (b) => ({ ...b, step: action.step }));
    case "clear":
      return [];
  }
}

const KEEP = 50;
const keyOf = (userId: string) => `mewki:mew:${userId}:v1`;

const isMessages = (value: unknown): value is Message[] => Array.isArray(value);

/** A reload mid-request leaves a reply typing forever: drop it. */
export function loadChat(userId: string | undefined): Message[] {
  if (!userId) return [];
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(keyOf(userId)) ?? "null");
    return isMessages(raw) ? raw.filter((m) => !(m.from === "mew" && m.typing)) : [];
  } catch {
    return [];
  }
}

export function saveChat(userId: string, messages: Message[]): void {
  try {
    localStorage.setItem(keyOf(userId), JSON.stringify(messages.slice(-KEEP)));
  } catch {
    // Quota or private mode: the chat just stops remembering.
  }
}
