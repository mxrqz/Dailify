/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";
import type { MewReply, Task } from "@dailify/shared";

import {
  type ConfirmBlock,
  type Message,
  chatReducer,
  isBox,
  loadChat,
  mewId,
  saveChat,
} from "./thread";

const task = (id: string, extra: Partial<Task> = {}): Task => ({
  id,
  title: id,
  date: 1_763_380_800_000,
  duration: "",
  priority: 0,
  repeat: "Off",
  completed: [],
  ...extra,
});

const created: MewReply = {
  reply: "Achei 2 tarefas.",
  intent: "propose",
  blocks: [
    { kind: "confirm", id: "c", action: "create", before: [], after: [task("a"), task("b")] },
  ],
};

const asked = (reply: MewReply = created) =>
  chatReducer(chatReducer([], { type: "send", id: "s", text: "oi" }), {
    type: "reply",
    to: mewId("s"),
    reply,
  });

const box = (messages: Message[]): ConfirmBlock => {
  const b = messages.flatMap((m) => (m.from === "mew" ? m.blocks : [])).at(-1);
  if (b?.kind !== "confirm") throw new Error("no confirm");
  return b;
};

beforeEach(() => localStorage.clear());

describe("chatReducer", () => {
  it("a send adds my message and a typing Mew, the reply fills it with intent and draft boxes", () => {
    const sent = chatReducer([], { type: "send", id: "s", text: "oi" });
    expect(sent.map((m) => m.from)).toEqual(["me", "mew"]);
    expect(asked()[1]).toMatchObject({ typing: false, text: created.reply, intent: "propose" });
    expect(box(asked())).toMatchObject({ step: "draft", off: [] });
  });

  it("confirm freezes only the checked, titled rows; undo and cancel follow the steps", () => {
    let s = chatReducer(asked(), { type: "toggle", block: "c", task: "b" });
    s = chatReducer(s, { type: "edit", block: "c", task: task("a", { title: "Pão" }) });
    s = chatReducer(s, { type: "confirm", block: "c" });
    expect(box(s).step).toBe("done");
    expect(box(s).after.map((x) => x.title)).toEqual(["Pão"]);
    // A cancel after confirming does nothing; undo does.
    expect(box(chatReducer(s, { type: "cancel", block: "c" })).step).toBe("done");
    expect(box(chatReducer(s, { type: "undo", block: "c" })).step).toBe("undone");
    expect(box(chatReducer(s, { type: "settle", block: "c", step: "draft" })).step).toBe("draft");
  });

  it("edit replaces only the draft with the same id, every field included", () => {
    const edited = task("b", { title: "Feira", priority: 2, tags: ["casa"] });
    const s = chatReducer(asked(), { type: "edit", block: "c", task: edited });
    expect(box(s).after).toEqual([task("a"), edited]);
    expect(box(chatReducer(s, { type: "confirm", block: "c" })).after).toEqual([task("a"), edited]);
  });

  it("a permission box allows once into a new typing reply, a send box edits and delivers", () => {
    const s = asked({
      reply: "Posso ler?",
      intent: "answer",
      blocks: [
        {
          kind: "permission",
          id: "p",
          provider: "google-calendar",
          capability: "read",
          target: "C1",
          label: "#geral",
        },
        {
          kind: "send",
          id: "d",
          provider: "google-calendar",
          target: "C1",
          to: "#geral",
          text: "Oi",
        },
      ],
    });
    const blocks = (m: Message[]) => m.flatMap((x) => (x.from === "mew" ? x.blocks : []));
    expect(blocks(s).map((b) => isBox(b) && b.step)).toEqual(["draft", "draft"]);

    let t = chatReducer(s, { type: "allow", block: "p", always: false });
    t = chatReducer(t, { type: "wait", id: "r" });
    expect(t.at(-1)).toMatchObject({ id: mewId("r"), from: "mew", typing: true });
    t = chatReducer(t, { type: "draft", block: "d", text: "Oi, João" });
    t = chatReducer(t, { type: "deliver", block: "d" });
    expect(blocks(t)).toMatchObject([
      { kind: "permission", step: "done" },
      { kind: "send", step: "done", text: "Oi, João" },
    ]);
    // Denying after allowing does nothing.
    expect(blocks(chatReducer(t, { type: "cancel", block: "p" }))[0]).toMatchObject({
      step: "done",
    });
  });

  it("an items card lands as is, with no step, survives a reload and no box action touches it", () => {
    const items = {
      kind: "items" as const,
      provider: "github" as const,
      source: "GitHub",
      url: "https://github.com/issues/assigned",
      total: 1,
      items: [{ title: "Bug", url: "https://github.com/a/b/issues/1", icon: "issue" as const }],
    };
    const s = asked({ reply: "Achei 1.", intent: "answer", blocks: [items] });
    const mew = s.at(-1);
    expect(mew?.from === "mew" && mew.blocks).toEqual([items]);
    expect(chatReducer(s, { type: "cancel", block: "x" })).toEqual(s);
    saveChat("u3", s);
    expect(loadChat("u3")).toEqual(s);
  });

  it("drop takes back a refused send", () => {
    expect(
      chatReducer(chatReducer([], { type: "send", id: "s", text: "oi" }), {
        type: "drop",
        id: "s",
      }),
    ).toEqual([]);
  });

  it("persists per user, keeps the last 50 and drops a reply that was still typing", () => {
    const many = Array.from(
      { length: 60 },
      (_, i) => chatReducer([], { type: "send", id: `${i}`, text: "x" })[0],
    );
    saveChat("u1", [...many, ...chatReducer([], { type: "send", id: "z", text: "y" })]);
    const loaded = loadChat("u1");
    expect(loaded).toHaveLength(49);
    expect(loaded.some((m) => m.from === "mew")).toBe(false);
    expect(loadChat("u2")).toEqual([]);
    expect(loadChat(undefined)).toEqual([]);
  });
});
