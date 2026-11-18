import { describe, it, expect, vi } from "vitest";

vi.mock("../src/auth", () => import("./session"));
import { auth, mockSession } from "./session";

import { env } from "cloudflare:workers";
import app from "../src/index";

// Every authenticated route. A new one gets a row: without a session it must answer 401.
const AUTHENTICATED: [method: string, path: string][] = [
  ["GET", "/tasks?month=2026-01"],
  ["GET", "/tasks/undated"],
  ["POST", "/tasks"],
  ["PATCH", "/tasks/t1"],
  ["DELETE", "/tasks/t1"],
  ["POST", "/tasks/t1/complete"],
  ["DELETE", "/tasks/t1/complete"],
  ["POST", "/tasks/parse"],
  ["POST", "/tasks/voice"],
  ["POST", "/mew/chat"],
  ["PATCH", "/mew/actions/a1"],
  ["GET", "/permissions"],
  ["POST", "/billing/checkout"],
  ["GET", "/billing/portal"],
  ["GET", "/billing/payment-details"],
  ["GET", "/billing/invoices"],
  ["GET", "/push/subscription"],
  ["POST", "/push/subscription"],
  ["DELETE", "/push/subscription"],
  ["GET", "/settings"],
  ["PUT", "/settings"],
  ["GET", "/integrations"],
  ["POST", "/integrations/google-calendar/connect"],
  ["POST", "/integrations/google-calendar/callback"],
  ["DELETE", "/integrations/google-calendar"],
  ["POST", "/integrations/google-calendar/events"],
  ["POST", "/integrations/google-calendar/events/t1/meet"],
  ["POST", "/integrations/google-calendar/events/t1/sync"],
  ["POST", "/integrations/google-calendar/duplicates/t1"],
];

describe("requireAuth", () => {
  it.each(AUTHENTICATED)("%s %s answers 401 without a session", async (method, path) => {
    mockSession(() => null);
    const res = await app.request(path, { method }, env);
    expect(res.status).toBe(401);
  });

  // Sub-apps sharing a prefix share middleware: a second requireAuth also spends a second limiter.
  it.each([
    ["POST", "/tasks/parse"],
    ["GET", "/integrations"],
  ])("%s %s reads the session once", async (method, path) => {
    mockSession(() => ({ id: `auth-${crypto.randomUUID()}` }));
    const spy = vi.spyOn(auth.api, "getSession");
    await app.request(path, { method, body: method === "GET" ? undefined : "{}" }, env);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
