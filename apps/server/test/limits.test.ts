import { env } from "cloudflare:test";
import { beforeAll, describe, it, expect } from "vitest";
import { applyD1Migrations } from "cloudflare:test";
import { limitsFor } from "@dailify/shared";
import { enforce, readAllUsage } from "../src/db/limits";
import { insertTask } from "../src/db/tasks";
import { bumpStoredUsage } from "../src/db/usage";
import type { Task } from "@dailify/shared";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

const task = (over: Partial<Task> = {}): Task => ({
  id: "l1",
  title: "T",
  date: new Date(2026, 5, 10, 9).getTime(),
  duration: "10m",
  priority: 0,
  repeat: "Off",
  completed: [],
  ...over,
});

describe("enforce", () => {
  it("deixa passar quando o limite é ilimitado, sem consultar o banco", async () => {
    const err = await enforce(env.DB, "le1", limitsFor("pro+ai"), "tasks", new Date(2026, 5, 1));
    expect(err).toBeNull();
  });

  it("deixa passar abaixo do limite", async () => {
    await insertTask(env.DB, "le2", task({ id: "le2-a" }));
    const err = await enforce(env.DB, "le2", limitsFor("free"), "tasks", new Date(2026, 5, 1));
    expect(err).toBeNull();
  });

  it("barra no limite exato", async () => {
    for (let i = 0; i < 3; i++) {
      await insertTask(env.DB, "le3", task({ id: `le3-${i}`, repeat: "Daily" }));
    }
    const err = await enforce(env.DB, "le3", limitsFor("free"), "recurring", new Date(2026, 5, 1));
    expect(err).toBe("Recurring Tasks Limit Reached");
  });

  it("conta voz do armazenamento, por mês", async () => {
    for (let i = 0; i < 3; i++) await bumpStoredUsage(env.DB, "le4", "voice", "2026-06");
    expect(await enforce(env.DB, "le4", limitsFor("free"), "voice", new Date(2026, 5, 20))).toBe(
      "Voice Limit Reached",
    );
    // Julho é outro período: a quota reinicia.
    expect(
      await enforce(env.DB, "le4", limitsFor("free"), "voice", new Date(2026, 6, 1)),
    ).toBeNull();
  });
});

describe("readAllUsage", () => {
  it("devolve as três chaves", async () => {
    await insertTask(env.DB, "le5", task({ id: "le5-a" }));
    await insertTask(env.DB, "le5", task({ id: "le5-b", repeat: "Daily" }));
    await bumpStoredUsage(env.DB, "le5", "voice", "2026-06");

    const usage = await readAllUsage(env.DB, "le5", new Date(2026, 5, 15));
    expect(usage).toEqual({ tasks: 2, recurring: 1, voice: 1 });
  });
});
