import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { limitsFor } from "@dailify/shared";
import { enforce, readAllUsage } from "../src/db/limits";
import { insertTask } from "../src/db/tasks";
import { bumpStoredUsage, periodFor } from "../src/db/usage";
import type { Task } from "@dailify/shared";

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
    const err = await enforce(env.DB, "le1", limitsFor("max"), "tasks", new Date(2026, 5, 1));
    expect(err).toBeNull();
  });

  it("deixa passar abaixo do limite", async () => {
    await insertTask(env.DB, "le2", task({ id: "le2-a" }));
    const err = await enforce(env.DB, "le2", limitsFor("free"), "tasks", new Date(2026, 5, 1));
    expect(err).toBeNull();
  });

  it("conta créditos de IA do período corrente do servidor, seja qual for a data recebida", async () => {
    for (let i = 0; i < limitsFor("free").ai; i++) {
      await bumpStoredUsage(env.DB, "le4", "ai", periodFor(new Date()));
    }
    // Crédito é ancorado em AGORA: o mês que o cliente pede não muda o período lido, senão navegar
    // pro mês que vem "devolveria" créditos que o servidor vai recusar.
    for (const at of [new Date(2026, 5, 20), new Date(2026, 6, 1), new Date(2030, 0, 1)]) {
      expect(await enforce(env.DB, "le4", limitsFor("free"), "ai", at)).toBe(
        "AI Credits Limit Reached",
      );
    }
  });

  it("crédito gravado em outro período não conta no corrente", async () => {
    for (let i = 0; i < 3; i++) await bumpStoredUsage(env.DB, "le6", "ai", "2000-01");
    expect(await enforce(env.DB, "le6", limitsFor("free"), "ai", new Date(2000, 0, 15))).toBeNull();
  });
});

describe("readAllUsage", () => {
  it("devolve todas as chaves", async () => {
    await insertTask(env.DB, "le5", task({ id: "le5-a" }));
    await insertTask(env.DB, "le5", task({ id: "le5-b", repeat: "Daily" }));
    await bumpStoredUsage(env.DB, "le5", "ai", periodFor(new Date()));

    // O `at` é o mês pedido pelo cliente: vale pra `tasks`, mas crédito lê sempre o mês do servidor.
    const usage = await readAllUsage(env.DB, "le5", new Date(2026, 5, 15));
    expect(usage).toEqual({ tasks: 2, ai: 1 });
  });
});
