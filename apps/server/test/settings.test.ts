import { describe, it, expect, vi, beforeAll } from "vitest";
import { getAuth } from "@clerk/hono";

vi.mock("@clerk/hono", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/hono")>();
  return { ...actual, getAuth: vi.fn(() => ({ userId: "u1" })) };
});

import { env, applyD1Migrations } from "cloudflare:test";
import app from "../src/index";
import { deleteUserData } from "../src/db/tasks";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

const put = (body: string) =>
  app.request(
    "/settings",
    { method: "PUT", headers: { "content-type": "application/json" }, body },
    env,
  );
const read = async () =>
  (await (await app.request("/settings", {}, env)).json<{ weekStart: number }>()).weekStart;

describe("GET/PUT /settings", () => {
  it("sem linha devolve o default 1", async () => {
    expect(await read()).toBe(1);
  });

  it("PUT grava e GET devolve; segundo PUT sobrescreve", async () => {
    const res = await put(JSON.stringify({ weekStart: 0 }));
    expect(await res.json()).toEqual({ weekStart: 0 });
    expect(await read()).toBe(0);
    await put(JSON.stringify({ weekStart: 6 }));
    expect(await read()).toBe(6);
  });

  it.each([{ weekStart: 7 }, { weekStart: -1 }, { weekStart: "mon" }, {}])(
    "PUT %j -> 400",
    async (body) => {
      expect((await put(JSON.stringify(body))).status).toBe(400);
    },
  );

  it("PUT sem corpo -> 400", async () => {
    expect((await put("")).status).toBe(400);
  });

  it("sem auth -> 401", async () => {
    const actual = await vi.importActual<typeof import("@clerk/hono")>("@clerk/hono");
    vi.mocked(getAuth).mockImplementationOnce(actual.getAuth);
    expect((await app.request("/settings", {}, env)).status).toBe(401);
  });

  it("deleteUserData volta ao default", async () => {
    await put(JSON.stringify({ weekStart: 3 }));
    await deleteUserData(env.DB, "u1");
    expect(await read()).toBe(1);
  });
});
