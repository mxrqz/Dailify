import { describe, it, expect } from "vitest";
import { taskHash, stampUpdatedAt, CLOCK_SKEW_MS } from "./hash";
import type { Task } from "./types";

const base: Omit<Task, "id" | "updatedAt" | "hash"> = {
  title: "Dentista",
  date: new Date(2026, 7, 30, 15).getTime(),
  duration: "1h",
  priority: 0,
  repeat: "Off",
  completed: [],
};

describe("taskHash", () => {
  it("is stable for the same content", () => {
    expect(taskHash(base)).toBe(taskHash({ ...base }));
  });

  it("changes when any content field changes", () => {
    expect(taskHash({ ...base, title: "Dentista!" })).not.toBe(taskHash(base));
    expect(taskHash({ ...base, date: base.date + 1 })).not.toBe(taskHash(base));
    expect(taskHash({ ...base, priority: 3 })).not.toBe(taskHash(base));
    expect(taskHash({ ...base, completed: [1] })).not.toBe(taskHash(base));
  });

  it("ignores the order of tags, links and completions", () => {
    const a = { ...base, tags: ["casa", "saúde"], links: ["https://b.com", "https://a.com"] };
    const b = { ...base, tags: ["saúde", "casa"], links: ["https://a.com", "https://b.com"] };
    expect(taskHash(a)).toBe(taskHash(b));
  });

  it("ignores the order of weekly days", () => {
    const a = { ...base, repeat: { Weekly: ["monday", "friday"] } };
    const b = { ...base, repeat: { Weekly: ["friday", "monday"] } };
    expect(taskHash(a)).toBe(taskHash(b));
  });

  it("separates tags absent from tags empty", () => {
    expect(taskHash({ ...base, tags: [] })).not.toBe(taskHash(base));
  });
});

describe("stampUpdatedAt", () => {
  const now = new Date(2026, 7, 30, 12).getTime();

  it("keeps the client stamp — offline edits happened when the client says", () => {
    expect(stampUpdatedAt(now - 60_000, now)).toBe(now - 60_000);
  });

  it("falls back to the server clock when there's no stamp", () => {
    expect(stampUpdatedAt(undefined, now)).toBe(now);
    expect(stampUpdatedAt(Number.NaN, now)).toBe(now);
  });

  it("refuses a clock running ahead beyond the skew window", () => {
    expect(stampUpdatedAt(now + CLOCK_SKEW_MS + 1, now)).toBe(now);
    expect(stampUpdatedAt(now + CLOCK_SKEW_MS - 1, now)).toBe(now + CLOCK_SKEW_MS - 1);
  });
});
