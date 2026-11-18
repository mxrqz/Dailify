import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

const { stripeMock } = vi.hoisted(() => {
  const stripeMock = {
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    subscriptions: { list: vi.fn(), retrieve: vi.fn() },
    invoices: { createPreview: vi.fn(), list: vi.fn() },
    webhooks: { constructEventAsync: vi.fn() },
  };
  return { stripeMock };
});

vi.mock("stripe", () => {
  function MockStripe() {
    return stripeMock;
  }
  MockStripe.createFetchHttpClient = () => ({});
  return { default: MockStripe };
});

vi.mock("../src/auth", () => import("./session"));
import { mockSession, seedUser } from "./session";
mockSession(() => ({ id: "u1" }));

import { env, applyD1Migrations } from "cloudflare:test";
import app from "../src/index";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

describe("GET /billing/payment-details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("400s when the user has no Stripe customer id", async () => {
    await seedUser(env.DB, "u1");
    const res = await app.request("/billing/payment-details", {}, env);
    expect(res.status).toBe(400);
  });

  it("returns null when there's no active subscription", async () => {
    await seedUser(env.DB, "u1", { stripeCustomerId: "cus_1" });
    stripeMock.subscriptions.list.mockResolvedValue({ data: [] });
    const res = await app.request("/billing/payment-details", {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it("maps the Stripe invoice preview to the PaymentDetails DTO", async () => {
    await seedUser(env.DB, "u1", { stripeCustomerId: "cus_1" });
    stripeMock.subscriptions.list.mockResolvedValue({ data: [{ id: "sub_1" }] });
    // After a Max -> Pro downgrade the preview leads with a proration credit at the old price.
    stripeMock.invoices.createPreview.mockResolvedValue({
      amount_due: 1999,
      currency: "usd",
      lines: {
        data: [
          {
            amount: -3000,
            currency: "usd",
            period: { start: 1735000000, end: 1735689600 },
            pricing: { price_details: { price: "price_max_year", product: "prod_2" } },
            parent: {
              type: "subscription_item_details",
              subscription_item_details: { proration: true },
            },
          },
          {
            amount: 4999,
            currency: "usd",
            period: { start: 1735689600, end: 1738368000 },
            pricing: { price_details: { price: "price_pro_month", product: "prod_1" } },
            parent: {
              type: "subscription_item_details",
              subscription_item_details: { proration: false },
            },
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
    await seedUser(env.DB, "u1");
    const res = await app.request("/billing/invoices", {}, env);
    expect(res.status).toBe(400);
  });

  it("maps Stripe invoices + their subscription's payment method to the Invoice DTO", async () => {
    await seedUser(env.DB, "u1", { stripeCustomerId: "cus_1" });
    stripeMock.invoices.list.mockResolvedValue({
      data: [
        {
          amount_paid: 4999,
          currency: "usd",
          status: "paid",
          created: 1735689600,
          hosted_invoice_url: "https://invoice.stripe.com/i/1",
          parent: { subscription_details: { subscription: "sub_1" } },
          lines: {
            data: [
              {
                parent: { type: "subscription_item_details", subscription_item_details: {} },
                pricing: { price_details: { price: "price_max_year" } },
              },
            ],
          },
        },
      ],
    });
    stripeMock.subscriptions.retrieve.mockResolvedValue({
      items: { data: [{ price: { id: "price_max_year" } }] },
      default_payment_method: {
        type: "card",
        card: {
          brand: "mastercard",
          last4: "1111",
          exp_month: 3,
          exp_year: 2031,
          wallet: { type: "apple_pay" },
        },
      },
    });

    const res = await app.request("/billing/invoices", {}, env);
    expect(res.status).toBe(200);
    const body = await res.json<unknown[]>();
    expect(body).toEqual([
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

  it("reads recurring from each invoice's plan line and fetches a shared subscription once", async () => {
    await seedUser(env.DB, "u1", { stripeCustomerId: "cus_1" });
    const invoice = (price: string) => ({
      amount_paid: 100,
      currency: "brl",
      status: "paid",
      created: 1735689600,
      hosted_invoice_url: null,
      parent: { subscription_details: { subscription: "sub_1" } },
      lines: {
        data: [
          {
            parent: {
              type: "subscription_item_details",
              subscription_item_details: { proration: false },
            },
            pricing: { price_details: { price } },
          },
        ],
      },
    });
    stripeMock.invoices.list.mockResolvedValue({
      data: [invoice("price_max_year"), invoice("price_pro_month")],
    });
    // The subscription moved to yearly since: the older invoice must still say month.
    stripeMock.subscriptions.retrieve.mockResolvedValue({
      items: { data: [{ price: { id: "price_max_year" } }] },
      default_payment_method: null,
    });

    const body = await (
      await app.request("/billing/invoices", {}, env)
    ).json<{ recurring: string }[]>();
    expect(body.map((i) => i.recurring)).toEqual(["year", "month"]);
    expect(stripeMock.subscriptions.retrieve).toHaveBeenCalledTimes(1);
  });
});
