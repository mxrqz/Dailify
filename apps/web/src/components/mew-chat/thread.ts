import { type AgendaTask, type Block, type ChatEvent, type ConfirmBlock, swap } from "./engine";

export type Message =
  | { id: string; from: "me"; text: string; image?: string }
  | { id: string; from: "mew"; text: string; typing: boolean; blocks: Block[] };

export interface ChatState {
  messages: Message[];
  tasks: AgendaTask[];
}

export type ChatAction =
  | { type: "send"; id: string; text: string; image?: string }
  | { type: "event"; to: string; event: ChatEvent }
  | { type: "edit"; block: string; task: string; title: string }
  | { type: "toggle"; block: string; task: string }
  | { type: "confirm" | "cancel" | "undo"; block: string }
  | { type: "complete"; task: string }
  | { type: "clear" }
  | { type: "reset"; tasks: AgendaTask[] };

export const mewId = (sendId: string) => `${sendId}-mew`;

const mapConfirm = (state: ChatState, id: string, fn: (block: ConfirmBlock) => ConfirmBlock) => ({
  ...state,
  messages: state.messages.map((m) =>
    m.from === "mew"
      ? {
          ...m,
          blocks: m.blocks.map((b) => (b.kind === "confirm" && b.id === id ? fn(b) : b)),
        }
      : m,
  ),
});

const findConfirm = (state: ChatState, id: string) =>
  state.messages
    .flatMap((m) => (m.from === "mew" ? m.blocks : []))
    .find((b): b is ConfirmBlock => b.kind === "confirm" && b.id === id);

function play(message: Message, event: ChatEvent): Message {
  if (message.from !== "mew") return message;
  if (event.type === "text") return { ...message, typing: false, text: event.text };
  if (event.type === "block")
    return { ...message, typing: false, blocks: [...message.blocks, event.block] };
  if (event.type === "settle")
    return {
      ...message,
      blocks: message.blocks.map((b) =>
        b.kind === "confirm" && b.id === event.id && b.step === "status"
          ? { ...b, step: "draft" }
          : b,
      ),
    };
  return message;
}

/** The whole preview — thread and fake agenda — in one reducer, so confirm and undo stay atomic. */
export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "send":
      return {
        ...state,
        messages: [
          ...state.messages,
          { id: action.id, from: "me", text: action.text, image: action.image },
          { id: mewId(action.id), from: "mew", text: "", typing: true, blocks: [] },
        ],
      };
    case "event":
      return {
        ...state,
        messages: state.messages.map((m) => (m.id === action.to ? play(m, action.event) : m)),
      };
    case "edit":
      return mapConfirm(state, action.block, (b) => ({
        ...b,
        after: b.after.map((x) => (x.id === action.task ? { ...x, title: action.title } : x)),
      }));
    case "toggle":
      return mapConfirm(state, action.block, (b) => ({
        ...b,
        off: b.off.includes(action.task)
          ? b.off.filter((id) => id !== action.task)
          : [...b.off, action.task],
      }));
    case "confirm": {
      const block = findConfirm(state, action.block);
      if (block?.step !== "draft") return state;
      // What was applied is frozen into `after`, so undo reverts exactly that.
      const after = block.after.filter((x) => !block.off.includes(x.id) && x.title.trim());
      if (!after.length && !block.before.length) return state;
      return {
        ...mapConfirm(state, block.id, (b) => ({ ...b, step: "done", after, off: [] })),
        tasks: swap(state.tasks, block.before, after),
      };
    }
    case "cancel":
      return mapConfirm(state, action.block, (b) =>
        b.step === "draft" ? { ...b, step: "cancelled" } : b,
      );
    case "undo": {
      const block = findConfirm(state, action.block);
      if (block?.step !== "done") return state;
      return {
        ...mapConfirm(state, block.id, (b) => ({ ...b, step: "undone" })),
        tasks: swap(state.tasks, block.after, block.before),
      };
    }
    case "complete":
      return {
        ...state,
        tasks: state.tasks.map((x) => (x.id === action.task ? { ...x, done: !x.done } : x)),
      };
    case "clear":
      return { ...state, messages: [] };
    case "reset":
      return { messages: [], tasks: action.tasks };
  }
}

// v2: a reply is one `text`, no longer `words`.
const KEY = "mewki:preview-mew:v2";

const isChatState = (value: unknown): value is ChatState =>
  typeof value === "object" &&
  value !== null &&
  "messages" in value &&
  "tasks" in value &&
  Array.isArray(value.messages) &&
  Array.isArray(value.tasks);

/** A reload mid-reply would leave it typing forever; settle whatever was in flight. */
export function loadChat(): ChatState | null {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (!isChatState(raw)) return null;
    return {
      tasks: raw.tasks,
      messages: raw.messages.map((m) =>
        m.from === "mew"
          ? {
              ...m,
              typing: false,
              blocks: m.blocks.map((b) =>
                b.kind === "confirm" && b.step === "status" ? { ...b, step: "draft" } : b,
              ),
            }
          : m,
      ),
    };
  } catch {
    return null;
  }
}

export function saveChat(state: ChatState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Quota or private mode: the preview just stops remembering.
  }
}
