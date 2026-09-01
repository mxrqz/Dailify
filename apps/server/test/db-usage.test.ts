import { env } from "cloudflare:test";
import { beforeAll, describe, it, expect } from "vitest";
import { applyD1Migrations } from "cloudflare:test";
import { periodFor, readStoredUsage, bumpStoredUsage } from "../src/db/usage";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe("periodFor", () => {
  it("quota mensal vira YYYY-MM", () => {
    expect(periodFor("voice", new Date(2026, 7, 31))).toBe("2026-08");
  });

  it("mês de um dígito ganha zero à esquerda", () => {
    expect(periodFor("voice", new Date(2026, 0, 5))).toBe("2026-01");
  });

  it("quota vitalícia não tem período", () => {
    expect(periodFor("recurring", new Date(2026, 7, 31))).toBe("all");
  });
});

describe("db/usage", () => {
  it("lê zero quando nunca houve uso", async () => {
    expect(await readStoredUsage(env.DB, "uz", "voice", "2026-08")).toBe(0);
  });

  it("conta cada bump", async () => {
    await bumpStoredUsage(env.DB, "ua", "voice", "2026-08");
    await bumpStoredUsage(env.DB, "ua", "voice", "2026-08");
    expect(await readStoredUsage(env.DB, "ua", "voice", "2026-08")).toBe(2);
  });

  it("separa por período", async () => {
    await bumpStoredUsage(env.DB, "ub", "voice", "2026-08");
    await bumpStoredUsage(env.DB, "ub", "voice", "2026-09");
    expect(await readStoredUsage(env.DB, "ub", "voice", "2026-08")).toBe(1);
    expect(await readStoredUsage(env.DB, "ub", "voice", "2026-09")).toBe(1);
  });

  it("separa por usuário", async () => {
    await bumpStoredUsage(env.DB, "uc", "voice", "2026-08");
    expect(await readStoredUsage(env.DB, "ud", "voice", "2026-08")).toBe(0);
  });
});
