import { describe, it, expect } from "vitest";
import { pending } from "./rejections";

const tick = () => new Promise((resolve) => setTimeout(resolve));

describe("unhandled rejections under workerd", () => {
  it("doesn't fail on a rejection returned from an async function and caught by its caller", async () => {
    const fail = async () => Promise.reject(new Error("handled one microtask later"));
    await expect(fail()).rejects.toThrow("handled one microtask later");
  });

  it("tracks a rejection nobody handles until a handler arrives", async () => {
    const orphan = Promise.reject(new Error("orphan"));
    await tick();
    expect(pending.has(orphan)).toBe(true);
    orphan.catch(() => {});
    await tick();
    expect(pending.has(orphan)).toBe(false);
  });
});
