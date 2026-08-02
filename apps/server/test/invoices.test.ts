import { describe, it, expect, vi, beforeEach } from "vitest";

const { stripeMock, getUserMock } = vi.hoisted(() => {
  const stripeMock = {
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    subscriptions: { list: vi.fn(), retrieve: vi.fn() },
    invoices: { createPreview: vi.fn(), list: vi.fn() },
    webhooks: { constructEventAsync: vi.fn() },
  };
  return { stripeMock, getUserMock: vi.fn() };
});

vi.mock("stripe", () => {
  function MockStripe() {
    return stripeMock;
  }
  MockStripe.createFetchHttpClient = () => ({});
  return { default: MockStripe };
});

vi.mock("@hono/clerk-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@hono/clerk-auth")>();
  return { ...actual, getAuth: vi.fn(() => ({ userId: "u1" })) };
});

vi.mock("../src/lib/clerk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/clerk")>();
  return { ...actual, clerk: vi.fn(() => ({ users: { getUser: getUserMock } })) };
});

import { env } from "cloudflare:test";
import app from "../src/index";

describe("GET /billing/payment-details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("400s when the user has no Stripe customer id", async () => {
    getUserMock.mockResolvedValue({ privateMetadata: {} });
    const res = await app.request("/billing/payment-details", {}, env);
    expect(res.status).toBe(400);
  });

  it("returns null when there's no active subscription", async () => {
    getUserMock.mockResolvedValue({ privateMetadata: { stripeCustomerId: "cus_1" } });
    stripeMock.subscriptions.list.mockResolvedValue({ data: [] });
    const res = await app.request("/billing/payment-details", {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it("maps the Stripe invoice preview to the PaymentDetails DTO", async () => {
    getUserMock.mockResolvedValue({ privateMetadata: { stripeCustomerId: "cus_1" } });
    stripeMock.subscriptions.list.mockResolvedValue({ data: [{ id: "sub_1" }] });
    stripeMock.invoices.createPreview.mockResolvedValue({
      lines: {
        data: [
          {
            amount: 1999,
            currency: "usd",
            period: { start: 1735689600, end: 1738368000 },
            pricing: { price_details: { price: "price_pro_month", product: "prod_1" } },
          },
        ],
      },
    });

    const res = await app.request("/billing/payment-details", {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      amount: 1999,
      currency: "usd",
      start: 1735689600,
      recurring: "month",
    });
    expect(stripeMock.invoices.createPreview).toHaveBeenCalledWith({
      customer: "cus_1",
      subscription: "sub_1",
    });
  });
});

describe("GET /billing/invoices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("400s when the user has no Stripe customer id", async () => {
    getUserMock.mockResolvedValue({ privateMetadata: {} });
    const res = await app.request("/billing/invoices", {}, env);
    expect(res.status).toBe(400);
  });

  it("maps Stripe invoices + their subscription's payment method to the Invoice DTO", async () => {
    getUserMock.mockResolvedValue({ privateMetadata: { stripeCustomerId: "cus_1" } });
    stripeMock.invoices.list.mockResolvedValue({
      data: [
        {
          amount_paid: 4999,
          currency: "usd",
          status: "paid",
          created: 1735689600,
          hosted_invoice_url: "https://invoice.stripe.com/i/1",
          parent: { subscription_details: { subscription: "sub_1" } },
        },
      ],
    });
    stripeMock.subscriptions.retrieve.mockResolvedValue({
      items: { data: [{ price: { id: "price_proai_year" } }] },
      default_payment_method: {
        type: "card",
        card: { brand: "mastercard", last4: "1111", exp_month: 3, exp_year: 2031, wallet: { type: "apple_pay" } },
      },
    });

    const res = await app.request("/billing/invoices", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ invoices: unknown[] }>();
    expect(body.invoices).toEqual([
      {
        recurring: "year",
        brandName: "mastercard",
        cardLast4: "1111",
        walletType: "apple_pay",
        paymentMethodType: "card",
        amount_paid: 4999,
        currency: "usd",
        status: "paid",
        created: 1735689600,
        hosted_invoice_url: "https://invoice.stripe.com/i/1",
      },
    ]);
    expect(stripeMock.subscriptions.retrieve).toHaveBeenCalledWith("sub_1", {
      expand: ["default_payment_method"],
    });
  });
});
