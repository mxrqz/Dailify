import { describe, it, expect, vi } from "vitest";

vi.mock("@clerk/hono", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/hono")>();
  return { ...actual, getAuth: vi.fn(() => ({ userId: "u1" })) };
});

vi.mock("../src/lib/clerk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/clerk")>();
  return { ...actual, getUserRole: vi.fn(async () => "free" as const) };
});

import { env } from "cloudflare:test";
import { PLAN_PERMISSIONS } from "@dailify/shared";
import app from "../src/index";

describe("GET /permissions", () => {
  it("returns the free matrix entry for a free-role user", async () => {
    const res = await app.request("/permissions", {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(PLAN_PERMISSIONS.free);
  });
});
