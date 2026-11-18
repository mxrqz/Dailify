import { TZDate } from "@date-fns/tz";
import { describe, expect, it } from "vitest";

import { type ConfirmBlock, reply, seedAgenda } from "./engine";
import { type ChatState, chatReducer, mewId } from "./thread";

const now = new TZDate(2026, 10, 17, 9, 0, "America/Sao_Paulo");

/** Sends `text` and plays every event the engine returns. */
function converse(state: ChatState, text: string): ChatState {
  let n = state.messages.length;
  const events = reply(text, { tasks: state.tasks, now, nextId: () => `b${++n}` });
  const id = `s${state.messages.length}`;
  return events.reduce(
    (s, event) => chatReducer(s, { type: "event", to: mewId(id), event }),
    chatReducer(state, { type: "send", id, text }),
  );
}
const lastConfirm = (state: ChatState): ConfirmBlock => {
  const m = state.messages.at(-1);
  const b = m?.from === "mew" ? m.blocks.at(-1) : undefined;
  if (b?.kind !== "confirm") throw new Error("no confirm");
  return b;
};

const start: ChatState = { messages: [], tasks: seedAgenda(now) };

describe("chatReducer", () => {
  it("adds my message and a typing Mew, then streams into it", () => {
    const sent = chatReducer(start, { type: "send", id: "a", text: "oi" });
    expect(sent.messages.map((m) => m.from)).toEqual(["me", "mew"]);
    const played = chatReducer(sent, {
      type: "event",
      to: mewId("a"),
      event: { type: "word", word: "Olá" },
    });
    expect(played.messages[1]).toMatchObject({ typing: false, words: ["Olá"] });
  });

  it("settles a status box into a draft", () => {
    expect(lastConfirm(converse(start, "joga os atrasados pra sexta")).step).toBe("draft");
  });

  it("confirms a move into the agenda, and undo puts it back", () => {
    const asked = converse(start, "joga os atrasados pra sexta");
    const id = lastConfirm(asked).id;
    const done = chatReducer(asked, { type: "confirm", block: id });
    expect(lastConfirm(done).step).toBe("done");
    expect(done.tasks).not.toEqual(start.tasks);
    const undone = chatReducer(done, { type: "undo", block: id });
    expect(lastConfirm(undone).step).toBe("undone");
    expect([...undone.tasks].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      [...start.tasks].sort((a, b) => a.id.localeCompare(b.id)),
    );
  });

  it("creates only the included drafts, with edited titles", () => {
    const asked = converse(start, "comprar pão, pagar luz dia 20");
    const block = lastConfirm(asked);
    const [bread, light] = block.after;
    let s = chatReducer(asked, { type: "edit", block: block.id, task: bread.id, title: "Pão" });
    s = chatReducer(s, { type: "toggle", block: block.id, task: light.id });
    s = chatReducer(s, { type: "confirm", block: block.id });
    expect(s.tasks.length).toBe(start.tasks.length + 1);
    expect(s.tasks.at(-1)?.title).toBe("Pão");
  });

  it("cancel leaves the agenda alone and confirm can't run after it", () => {
    const asked = converse(start, "apaga 'academia'");
    const id = lastConfirm(asked).id;
    const s = chatReducer(chatReducer(asked, { type: "cancel", block: id }), {
      type: "confirm",
      block: id,
    });
    expect(lastConfirm(s).step).toBe("cancelled");
    expect(s.tasks).toEqual(start.tasks);
  });

  it("clear empties the thread but keeps the agenda", () => {
    const s = chatReducer(converse(start, "o que tenho hoje"), { type: "clear" });
    expect(s).toEqual({ messages: [], tasks: start.tasks });
  });
});
