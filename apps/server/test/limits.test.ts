import { env } from "cloudflare:test";
import { beforeAll, describe, it, expect } from "vitest";
import { applyD1Migrations } from "cloudflare:test";
import { limitsFor } from "@dailify/shared";
import { enforce, readAllUsage } from "../src/db/limits";
import { insertTask } from "../src/db/tasks";
import { bumpStoredUsage, periodFor } from "../src/db/usage";
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

  it("conta voz do período corrente do servidor, seja qual for a data recebida", async () => {
    for (let i = 0; i < 3; i++) {
      await bumpStoredUsage(env.DB, "le4", "voice", periodFor("voice", new Date()));
    }
    // Voz é ancorada em AGORA: o mês que o cliente pede não muda o período lido, senão navegar pro
    // mês que vem "devolveria" comandos que o servidor vai recusar.
    for (const at of [new Date(2026, 5, 20), new Date(2026, 6, 1), new Date(2030, 0, 1)]) {
      expect(await enforce(env.DB, "le4", limitsFor("free"), "voice", at)).toBe(
        "Voice Limit Reached",
      );
    }
  });

  it("uso de voz gravado em outro período não conta no corrente", async () => {
    for (let i = 0; i < 3; i++) await bumpStoredUsage(env.DB, "le6", "voice", "2000-01");
    expect(
      await enforce(env.DB, "le6", limitsFor("free"), "voice", new Date(2000, 0, 15)),
    ).toBeNull();
  });
});

describe("readAllUsage", () => {
  it("devolve as três chaves", async () => {
    await insertTask(env.DB, "le5", task({ id: "le5-a" }));
    await insertTask(env.DB, "le5", task({ id: "le5-b", repeat: "Daily" }));
    await bumpStoredUsage(env.DB, "le5", "voice", periodFor("voice", new Date()));

    // O `at` é o mês pedido pelo cliente: vale pra `tasks`, mas voz lê sempre o mês do servidor.
    const usage = await readAllUsage(env.DB, "le5", new Date(2026, 5, 15));
    expect(usage).toEqual({ tasks: 2, recurring: 1, voice: 1 });
  });
});
