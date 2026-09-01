import { describe, it, expect, beforeAll, vi } from "vitest";

// Mutável e fechado pelo mock abaixo: cada teste assinala o seu próprio id (padrão de
// voice.test.ts) para não dividir usuário — e portanto contagem de uso — com os outros.
let userId = "u1";

vi.mock("@clerk/hono", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/hono")>();
  return { ...actual, getAuth: vi.fn(() => ({ userId })) };
});

vi.mock("../src/lib/clerk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/clerk")>();
  return { ...actual, getUserRole: vi.fn(async () => "free" as const) };
});

import { env } from "cloudflare:test";
import { applyD1Migrations } from "cloudflare:test";
import { limitsFor } from "@dailify/shared";
import { insertTask } from "../src/db/tasks";
import app from "../src/index";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe("GET /permissions", () => {
  // Janeiro/2026 é um mês em que nenhum teste deste arquivo escreve: a asserção de zeros não
  // depende da ordem em que os testes rodam.
  it("devolve limites e uso do papel", async () => {
    userId = "u1";
    const res = await app.request("/permissions?month=2026-01", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ limits: unknown; usage: unknown }>();
    expect(body.limits).toEqual(limitsFor("free"));
    expect(body.usage).toEqual({ tasks: 0, recurring: 0, voice: 0 });
  });

  it("conta o uso do mês pedido", async () => {
    userId = "u1";
    await insertTask(env.DB, userId, {
      id: "pm1",
      title: "T",
      date: new Date(2026, 2, 10, 9).getTime(),
      duration: "10m",
      priority: 0,
      repeat: "Off",
      completed: [],
    });

    const march = await app.request("/permissions?month=2026-03", {}, env);
    expect((await march.json<{ usage: { tasks: number } }>()).usage.tasks).toBe(1);

    const april = await app.request("/permissions?month=2026-04", {}, env);
    expect((await april.json<{ usage: { tasks: number } }>()).usage.tasks).toBe(0);
  });

  it("mês inválido cai no mês corrente em vez de estourar", async () => {
    // Usuário próprio: um insert datado de "agora" não pode contaminar as asserções fixas em
    // 2026-01/03/04 das outras duas — nem depender de em que mês a suíte é executada.
    userId = "u-month-fallback";
    await insertTask(env.DB, userId, {
      id: "im1",
      title: "T",
      date: Date.now(),
      duration: "10m",
      priority: 0,
      repeat: "Off",
      completed: [],
    });

    const fallback = await app.request("/permissions?month=banana", {}, env);
    expect(fallback.status).toBe(200);
    // A prova de que caiu no mês corrente: a tarefa datada de "agora" aparece no uso.
    expect((await fallback.json<{ usage: { tasks: number } }>()).usage.tasks).toBe(1);

    // E, para não ser coincidência, um mês explícito (mas não o corrente) não vê a tarefa.
    const now = new Date();
    const other = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const otherMonth = `${other.getFullYear()}-${String(other.getMonth() + 1).padStart(2, "0")}`;
    const elsewhere = await app.request(`/permissions?month=${otherMonth}`, {}, env);
    expect((await elsewhere.json<{ usage: { tasks: number } }>()).usage.tasks).toBe(0);
  });
});
