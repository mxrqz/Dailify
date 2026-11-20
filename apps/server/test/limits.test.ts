import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { limitsFor } from "@dailify/shared";
import { enforce, readAllUsage } from "../src/db/limits";
import { bumpStoredUsage, periodFor } from "../src/db/usage";

describe("enforce", () => {
  it("lets an unlimited plan through", async () => {
    expect(await enforce(env.DB, "le1", limitsFor("admin"), "ai")).toBeNull();
  });

  it("stops at the limit of AI credits in the current period", async () => {
    for (let i = 0; i < limitsFor("free").ai; i++) {
      await bumpStoredUsage(env.DB, "le4", "ai", periodFor(new Date()));
    }
    expect(await enforce(env.DB, "le4", limitsFor("free"), "ai")).toBe("AI Credits Limit Reached");
  });

  it("does not count credit stored in another period", async () => {
    for (let i = 0; i < 3; i++) await bumpStoredUsage(env.DB, "le6", "ai", "2000-01");
    for (let i = 0; i < 29; i++) await bumpStoredUsage(env.DB, "le6", "ai", periodFor(new Date()));
    expect(await enforce(env.DB, "le6", limitsFor("free"), "ai")).toBeNull();
  });
});

describe("readAllUsage", () => {
  it("returns every quota key", async () => {
    await bumpStoredUsage(env.DB, "le5", "ai", periodFor(new Date()));
    expect(await readAllUsage(env.DB, "le5")).toEqual({ ai: 1 });
  });
});
