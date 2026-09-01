import { describe, it, expect, beforeAll, vi } from "vitest";

vi.mock("@clerk/hono", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/hono")>();
  return { ...actual, getAuth: vi.fn(() => ({ userId: "u1" })) };
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
    const res = await app.request("/permissions?month=2026-01", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ limits: unknown; usage: unknown }>();
    expect(body.limits).toEqual(limitsFor("free"));
    expect(body.usage).toEqual({ tasks: 0, recurring: 0, voice: 0 });
  });

  it("conta o uso do mês pedido", async () => {
    await insertTask(env.DB, "u1", {
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
    const res = await app.request("/permissions?month=banana", {}, env);
    expect(res.status).toBe(200);
  });
});
