import { describe, it, expect, vi } from "vitest";

// Mutável e fechado pelo mock abaixo: cada teste assinala o seu próprio id (padrão de
// voice.test.ts) para não dividir usuário — e portanto contagem de uso — com os outros.
let userId = "u1";

vi.mock("../src/auth", () => import("./session"));
import { mockSession } from "./session";
mockSession(() => ({ id: userId }));

import { env } from "cloudflare:test";
import { limitsFor } from "@dailify/shared";
import { bumpStoredUsage, periodFor } from "../src/db/usage";
import app from "../src/index";

describe("GET /permissions", () => {
  it("devolve limites e uso do papel", async () => {
    userId = "u1";
    const res = await app.request("/permissions?month=2026-01", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ limits: unknown; usage: unknown }>();
    expect(body.limits).toEqual(limitsFor("free"));
    expect(body.usage).toEqual({ ai: 0 });
  });

  it("counts AI credits of the server's current month whatever month the client sends", async () => {
    userId = "u-ai";
    await bumpStoredUsage(env.DB, userId, "ai", periodFor(new Date()));
    const res = await app.request("/permissions?month=2026-01", {}, env);
    expect((await res.json<{ usage: unknown }>()).usage).toEqual({ ai: 1 });
  });
});
