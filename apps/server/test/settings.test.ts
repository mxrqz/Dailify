import { describe, it, expect, vi } from "vitest";

vi.mock("../src/auth", () => import("./session"));
import { mockSession } from "./session";
mockSession(() => ({ id: "u1" }));

import { env } from "cloudflare:test";
import app from "../src/index";
import { deleteUserData } from "../src/db/user";

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
    expect(await res.json()).toMatchObject({ weekStart: 0 });
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

  it("fuso começa automático (null) e 24h; PUT parcial não mexe no resto", async () => {
    await deleteUserData(env.DB, "u1");
    const all = async () =>
      (await app.request("/settings", {}, env)).json<{
        weekStart: number;
        timeZone: string | null;
        hour12: boolean;
        mewConsent: boolean;
      }>();
    expect(await all()).toEqual({
      weekStart: 1,
      timeZone: null,
      hour12: false,
      mewConsent: false,
    });

    await put(JSON.stringify({ timeZone: "Europe/Lisbon" }));
    await put(JSON.stringify({ hour12: true }));
    expect(await all()).toEqual({
      weekStart: 1,
      timeZone: "Europe/Lisbon",
      hour12: true,
      mewConsent: false,
    });

    // null volta pro automático.
    await put(JSON.stringify({ timeZone: null }));
    expect((await all()).timeZone).toBeNull();
  });

  it("mewConsent grava a hora do primeiro aceite e false apaga", async () => {
    await deleteUserData(env.DB, "u1");
    const consentAt = async () =>
      (
        await env.DB.prepare("SELECT mew_consent_at FROM user_settings WHERE user_id='u1'").first<{
          mew_consent_at: number | null;
        }>()
      )?.mew_consent_at;
    expect(await (await put(JSON.stringify({ mewConsent: true }))).json()).toMatchObject({
      mewConsent: true,
    });
    const first = await consentAt();
    expect(first).toBeTypeOf("number");
    await env.DB.prepare("UPDATE user_settings SET mew_consent_at=1 WHERE user_id='u1'").run();
    await put(JSON.stringify({ weekStart: 0 }));
    expect(await consentAt()).toBe(1);
    await put(JSON.stringify({ mewConsent: false }));
    expect(await consentAt()).toBeNull();
  });

  it.each([{ timeZone: "Marte/Olimpo" }, { timeZone: 3 }, { hour12: "sim" }, { mewConsent: 1 }])(
    "PUT %j -> 400",
    async (body) => {
      expect((await put(JSON.stringify(body))).status).toBe(400);
    },
  );

  it("PUT sem corpo -> 400", async () => {
    expect((await put("")).status).toBe(400);
  });

  it("sem auth -> 401", async () => {
    mockSession(() => null);
    expect((await app.request("/settings", {}, env)).status).toBe(401);
    mockSession(() => ({ id: "u1" }));
  });

  it("deleteUserData volta ao default", async () => {
    await put(JSON.stringify({ weekStart: 3 }));
    await deleteUserData(env.DB, "u1");
    expect(await read()).toBe(1);
  });
});
