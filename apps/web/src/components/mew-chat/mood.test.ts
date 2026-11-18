import { describe, expect, it } from "vitest";

import { copy } from "@/components/dashboard/copy";

import { moodOf } from "./chat-drawer";
import type { ConfirmBlock } from "./engine";
import type { Message } from "./thread";

const mew = (text: string, blocks: ConfirmBlock["step"][] = [], typing = false): Message => ({
  id: "m",
  from: "mew",
  text,
  typing,
  blocks: blocks.map((step) => ({
    kind: "confirm",
    id: "c",
    action: "create",
    step,
    before: [],
    after: [],
    off: [],
  })),
});

describe("moodOf", () => {
  it("follows the latest turn", () => {
    expect(moodOf(undefined, false, true)).toBe("listening");
    expect(moodOf({ id: "u", from: "me", text: "oi" }, true, false)).toBe("thinking");
    expect(moodOf(mew("", [], true), true, false)).toBe("thinking");
    expect(moodOf(mew("Achei", ["draft"]), false, false)).toBe("alert");
    expect(moodOf(mew("Achei", ["done"]), false, false)).toBe("happy");
    expect(moodOf(mew(copy.mewChat.reply.fallback), false, false)).toBe("confused");
    expect(moodOf(mew("Você tem 2 coisas hoje:"), false, false)).toBe("idle");
  });
});
