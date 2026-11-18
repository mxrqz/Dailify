import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { periodFor, readStoredUsage, bumpStoredUsage } from "../src/db/usage";

describe("periodFor", () => {
  it("quota mensal vira YYYY-MM", () => {
    expect(periodFor(new Date(Date.UTC(2026, 7, 31)))).toBe("2026-08");
  });

  it("mês de um dígito ganha zero à esquerda", () => {
    expect(periodFor(new Date(Date.UTC(2026, 0, 5)))).toBe("2026-01");
  });

  it("uses the UTC month, not the machine zone", () => {
    expect(periodFor(new Date(Date.UTC(2026, 0, 31, 23, 30)))).toBe("2026-01");
  });
});

describe("db/usage", () => {
  it("lê zero quando nunca houve uso", async () => {
    expect(await readStoredUsage(env.DB, "uz", "ai", "2026-08")).toBe(0);
  });

  it("conta cada bump", async () => {
    await bumpStoredUsage(env.DB, "ua", "ai", "2026-08");
    await bumpStoredUsage(env.DB, "ua", "ai", "2026-08");
    expect(await readStoredUsage(env.DB, "ua", "ai", "2026-08")).toBe(2);
  });

  it("separa por período", async () => {
    await bumpStoredUsage(env.DB, "ub", "ai", "2026-08");
    await bumpStoredUsage(env.DB, "ub", "ai", "2026-09");
    expect(await readStoredUsage(env.DB, "ub", "ai", "2026-08")).toBe(1);
    expect(await readStoredUsage(env.DB, "ub", "ai", "2026-09")).toBe(1);
  });

  it("separa por usuário", async () => {
    await bumpStoredUsage(env.DB, "uc", "ai", "2026-08");
    expect(await readStoredUsage(env.DB, "ud", "ai", "2026-08")).toBe(0);
  });
});
