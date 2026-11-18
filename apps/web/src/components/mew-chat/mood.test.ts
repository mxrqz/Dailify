import { describe, expect, it } from "vitest";
import type { MewIntent } from "@dailify/shared";

import { moodOf } from "./mood";
import type { Message, Step } from "./thread";

const mew = (
  steps: Step[] = [],
  { typing = false, intent = "answer" }: { typing?: boolean; intent?: MewIntent } = {},
): Message => ({
  id: "m",
  from: "mew",
  text: "Oi",
  typing,
  intent,
  blocks: steps.map((step) => ({
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
    expect(moodOf(undefined, false)).toBe("idle");
    expect(moodOf({ id: "u", from: "me", text: "oi" }, true)).toBe("thinking");
    expect(moodOf(mew([], { typing: true }), true)).toBe("thinking");
    expect(moodOf(mew(["draft"]), false)).toBe("alert");
    expect(moodOf(mew(["done"]), false)).toBe("happy");
    expect(moodOf(mew([], { intent: "notFound" }), false)).toBe("confused");
    expect(moodOf(mew([], { intent: "unsupported" }), false)).toBe("confused");
    expect(moodOf(mew(), false)).toBe("idle");
  });
});
