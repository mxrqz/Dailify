import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

const { stripeMock, profileMock } = vi.hoisted(() => {
  const stripeMock = {
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    subscriptions: { list: vi.fn(), retrieve: vi.fn() },
    invoices: { createPreview: vi.fn(), list: vi.fn() },
    webhooks: { constructEventAsync: vi.fn() },
  };
  return {
    stripeMock,
    profileMock: vi.fn<() => Promise<{ email?: string; stripeCustomerId?: string }>>(),
  };
});

vi.mock("stripe", () => {
  function MockStripe() {
    return stripeMock;
  }
  MockStripe.createFetchHttpClient = () => ({});
  return { default: MockStripe };
});

vi.mock("../src/auth", () => import("./session"));
import { mockSession } from "./session";
mockSession(() => ({ id: "u1" }));

vi.mock("../src/lib/user", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/user")>();
  return { ...actual, billingProfile: profileMock };
});

import { env, applyD1Migrations } from "cloudflare:test";
import app from "../src/index";

// O `requireAuth` lê o `plan` do D1.
beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

const post = (body: unknown, headers: Record<string, string> = {}) =>
  app.request(
    "/billing/checkout",
    {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    },
    env,
  );

describe("POST /billing/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("400s on an unknown productName", async () => {
    const res = await post({ productName: "not-a-real-plan" });
    expect(res.status).toBe(400);
  });

  it("400s on a productName that only exists on Object.prototype", async () => {
    expect((await post({ productName: "toString" })).status).toBe(400);
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("creates a checkout session and returns its url when there's no active subscription", async () => {
    profileMock.mockResolvedValue({ email: "a@b.com" });
    stripeMock.checkout.sessions.create.mockResolvedValue({
      url: "https://checkout.stripe.com/xyz",
    });

    const res = await post({ productName: "pro" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://checkout.stripe.com/xyz" });
    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: "price_pro_month", quantity: 1 }],
        customer_email: "a@b.com",
        // rotas que existem em apps/web/src/App.tsx — /sucesso e /cancel não existiam
        success_url: "https://dailify.mxrqz.com/billing?checkout=success",
        cancel_url: "https://dailify.mxrqz.com/billing?checkout=cancel",
      }),
    );
  });

  it("sends the user back to the allowed origin they came from, else the first one", async () => {
    profileMock.mockResolvedValue({});
    stripeMock.checkout.sessions.create.mockResolvedValue({
      url: "https://checkout.stripe.com/xyz",
    });

    await post({ productName: "pro" }, { Origin: "https://mewki.mxrqz.com" });
    await post({ productName: "pro" }, { Origin: "https://evil.example" });
    const urls = stripeMock.checkout.sessions.create.mock.calls.map(([arg]) => arg.success_url);
    expect(urls).toEqual([
      "https://mewki.mxrqz.com/billing?checkout=success",
      "https://dailify.mxrqz.com/billing?checkout=success",
    ]);
  });

  it("sends the app back through its App Link domain, whatever the first origin is", async () => {
    profileMock.mockResolvedValue({});
    stripeMock.checkout.sessions.create.mockResolvedValue({
      url: "https://checkout.stripe.com/xyz",
    });

    await post({ productName: "pro" }, { Origin: "http://tauri.localhost" });
    await post({ productName: "pro" }, { Origin: "tauri://localhost" });
    const calls = stripeMock.checkout.sessions.create.mock.calls.map(([arg]) => [
      arg.success_url,
      arg.cancel_url,
    ]);
    expect(calls).toEqual([
      [
        "https://mewki.mxrqz.com/app/billing?checkout=success",
        "https://mewki.mxrqz.com/app/billing?checkout=cancel",
      ],
      [
        "https://mewki.mxrqz.com/app/billing?checkout=success",
        "https://mewki.mxrqz.com/app/billing?checkout=cancel",
      ],
    ]);
  });

  it("returns a billing-portal url instead when the user already has an active subscription", async () => {
    profileMock.mockResolvedValue({ stripeCustomerId: "cus_1" });
    stripeMock.subscriptions.list.mockResolvedValue({ data: [{ id: "sub_1" }] });
    stripeMock.billingPortal.sessions.create.mockResolvedValue({
      url: "https://billing.stripe.com/p",
    });

    const res = await post({ productName: "max-year" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://billing.stripe.com/p" });
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("reuses the existing Stripe customer instead of creating a duplicate", async () => {
    profileMock.mockResolvedValue({ email: "a@b.com", stripeCustomerId: "cus_1" });
    stripeMock.subscriptions.list.mockResolvedValue({ data: [] });
    stripeMock.checkout.sessions.create.mockResolvedValue({ url: "https://checkout.stripe.com/x" });

    await post({ productName: "pro" });
    const [arg] = stripeMock.checkout.sessions.create.mock.calls[0];
    expect(arg).toMatchObject({ customer: "cus_1" });
    expect(arg).not.toHaveProperty("customer_email");
  });
});

describe("GET /billing/portal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("400s when the user has no Stripe customer id", async () => {
    profileMock.mockResolvedValue({});
    const res = await app.request("/billing/portal", {}, env);
    expect(res.status).toBe(400);
  });

  it("returns a billing-portal url", async () => {
    profileMock.mockResolvedValue({ stripeCustomerId: "cus_1" });
    stripeMock.billingPortal.sessions.create.mockResolvedValue({
      url: "https://billing.stripe.com/p",
    });
    const res = await app.request("/billing/portal", {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://billing.stripe.com/p" });
  });
});

describe("CORS", () => {
  const preflight = (origin: string) =>
    app.request(
      "/health",
      { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "GET" } },
      env,
    );

  it("allows every listed origin and rejects others", async () => {
    for (const o of ["https://dailify.mxrqz.com", "https://mewki.mxrqz.com"]) {
      expect((await preflight(o)).headers.get("access-control-allow-origin")).toBe(o);
    }
    expect(
      (await preflight("https://evil.example")).headers.get("access-control-allow-origin"),
    ).toBeNull();
  });

  it("lets the session cookie through and exposes the bearer token header", async () => {
    const res = await app.request(
      "/auth/get-session",
      {
        method: "OPTIONS",
        headers: {
          Origin: "https://mewki.mxrqz.com",
          "Access-Control-Request-Method": "GET",
          "Access-Control-Request-Headers": "x-mewki-verifier",
        },
      },
      env,
    );
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
    expect(res.headers.get("access-control-allow-headers")).toContain("x-mewki-verifier");
    const get = await app.request(
      "/health",
      { headers: { Origin: "https://mewki.mxrqz.com" } },
      env,
    );
    expect(get.headers.get("access-control-expose-headers")).toContain("set-auth-token");
  });

  it("lets the browser cache the preflight", async () => {
    expect((await preflight("https://mewki.mxrqz.com")).headers.get("access-control-max-age")).toBe(
      "86400",
    );
  });
});
