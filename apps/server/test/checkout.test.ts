import { describe, it, expect, vi, beforeEach } from "vitest";

const { stripeMock, getUserMock, updateUserMetadataMock } = vi.hoisted(() => {
  const stripeMock = {
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    subscriptions: { list: vi.fn(), retrieve: vi.fn() },
    invoices: { createPreview: vi.fn(), list: vi.fn() },
    webhooks: { constructEventAsync: vi.fn() },
  };
  return { stripeMock, getUserMock: vi.fn(), updateUserMetadataMock: vi.fn() };
});

vi.mock("stripe", () => {
  function MockStripe() {
    return stripeMock;
  }
  MockStripe.createFetchHttpClient = () => ({});
  return { default: MockStripe };
});

vi.mock("@clerk/hono", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@clerk/hono")>();
  return { ...actual, getAuth: vi.fn(() => ({ userId: "u1" })) };
});

vi.mock("../src/lib/clerk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/clerk")>();
  return {
    ...actual,
    clerk: vi.fn(() => ({
      users: { getUser: getUserMock, updateUserMetadata: updateUserMetadataMock },
    })),
  };
});

import { env } from "cloudflare:test";
import app from "../src/index";

const post = (body: unknown) =>
  app.request(
    "/billing/checkout",
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
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

  it("creates a checkout session and returns its url when there's no active subscription", async () => {
    getUserMock.mockResolvedValue({
      id: "u1",
      privateMetadata: {},
      emailAddresses: [{ id: "e1", emailAddress: "a@b.com" }],
      primaryEmailAddressId: "e1",
    });
    stripeMock.checkout.sessions.create.mockResolvedValue({ url: "https://checkout.stripe.com/xyz" });

    const res = await post({ productName: "pro" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://checkout.stripe.com/xyz" });
    expect(stripeMock.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: "price_pro_month", quantity: 1 }],
        customer_email: "a@b.com",
        // rotas que existem em apps/web/src/App.tsx — /sucesso e /cancel não existiam
        success_url: `${env.ALLOWED_ORIGIN}/billing?checkout=success`,
        cancel_url: `${env.ALLOWED_ORIGIN}/billing?checkout=cancel`,
      }),
    );
  });

  it("returns a billing-portal url instead when the user already has an active subscription", async () => {
    getUserMock.mockResolvedValue({
      id: "u1",
      privateMetadata: { stripeCustomerId: "cus_1" },
      emailAddresses: [],
      primaryEmailAddressId: null,
    });
    stripeMock.subscriptions.list.mockResolvedValue({ data: [{ id: "sub_1" }] });
    stripeMock.billingPortal.sessions.create.mockResolvedValue({ url: "https://billing.stripe.com/p" });

    const res = await post({ productName: "pro+ai-year" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://billing.stripe.com/p" });
    expect(stripeMock.checkout.sessions.create).not.toHaveBeenCalled();
  });
});

describe("GET /billing/portal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("400s when the user has no Stripe customer id", async () => {
    getUserMock.mockResolvedValue({
      id: "u1",
      privateMetadata: {},
      emailAddresses: [],
      primaryEmailAddressId: null,
    });
    const res = await app.request("/billing/portal", {}, env);
    expect(res.status).toBe(400);
  });

  it("returns a billing-portal url", async () => {
    getUserMock.mockResolvedValue({
      id: "u1",
      privateMetadata: { stripeCustomerId: "cus_1" },
      emailAddresses: [],
      primaryEmailAddressId: null,
    });
    stripeMock.billingPortal.sessions.create.mockResolvedValue({ url: "https://billing.stripe.com/p" });
    const res = await app.request("/billing/portal", {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://billing.stripe.com/p" });
  });
});
