import { describe, it, expect, vi } from "vitest";

vi.mock("../src/auth", () => import("./session"));
import { mockSession } from "./session";
mockSession(() => ({ id: "u1" }));

vi.mock("../src/db/limits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/db/limits")>();
  return {
    ...actual,
    readAllUsage: vi.fn(async () => {
      throw new Error("boom");
    }),
  };
});

import { env } from "cloudflare:test";
import app from "../src/index";

describe("global error handler", () => {
  it("returns a JSON 500 envelope when a route handler throws", async () => {
    const res = await app.request("/permissions", {}, env);
    expect(res.status).toBe(500);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({ error: "Internal error" });
  });
});
