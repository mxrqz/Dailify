import { describe, it, expect, vi, beforeEach } from "vitest";

const { stripeMock, updateUserRoleMock, updateUserBillingDetailsMock } = vi.hoisted(() => {
  const stripeMock = {
    checkout: { sessions: { create: vi.fn() } },
    billingPortal: { sessions: { create: vi.fn() } },
    subscriptions: { list: vi.fn(), retrieve: vi.fn() },
    invoices: { createPreview: vi.fn(), list: vi.fn() },
    webhooks: { constructEventAsync: vi.fn() },
  };
  return { stripeMock, updateUserRoleMock: vi.fn(), updateUserBillingDetailsMock: vi.fn() };
});

vi.mock("stripe", () => {
  function MockStripe() {
    return stripeMock;
  }
  MockStripe.createFetchHttpClient = () => ({});
  return { default: MockStripe };
});

vi.mock("../src/lib/clerk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/lib/clerk")>();
  return {
    ...actual,
    updateUserRole: updateUserRoleMock,
    updateUserBillingDetails: updateUserBillingDetailsMock,
  };
});

import { env } from "cloudflare:test";
import app from "../src/index";

const post = (body: string, sig?: string) =>
  app.request(
    "/webhooks/stripe",
    { method: "POST", headers: sig ? { "stripe-signature": sig } : {}, body },
    env,
  );

describe("POST /webhooks/stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("400s when the stripe-signature header is missing", async () => {
    const res = await post("{}");
    expect(res.status).toBe(400);
    expect(stripeMock.webhooks.constructEventAsync).not.toHaveBeenCalled();
  });

  it("400s when signature verification fails", async () => {
    stripeMock.webhooks.constructEventAsync.mockRejectedValue(new Error("bad signature"));
    const res = await post("{}", "t=1,v1=bogus");
    expect(res.status).toBe(400);
  });

  it("routes invoice.paid to the role + billing update", async () => {
    stripeMock.webhooks.constructEventAsync.mockResolvedValue({
      type: "invoice.paid",
      data: {
        object: {
          customer: "cus_1",
          currency: "usd",
          amount_due: 999,
          parent: {
            subscription_details: {
              metadata: { clerkUserId: "u1" },
              subscription: "sub_1",
            },
          },
          lines: {
            data: [{ pricing: { price_details: { price: "price_pro_month", product: "prod_1" } } }],
          },
        },
      },
    });
    stripeMock.subscriptions.retrieve.mockResolvedValue({
      items: { data: [{ current_period_end: 1735689600 }] },
      default_payment_method: {
        type: "card",
        card: { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2030, wallet: null },
      },
    });

    const res = await post("{}", "t=1,v1=abc");
    expect(res.status).toBe(200);
    expect(updateUserRoleMock).toHaveBeenCalledWith(expect.anything(), {
      clerkUserId: "u1",
      role: "pro",
      stripeCustomerId: "cus_1",
    });
    expect(updateUserBillingDetailsMock).toHaveBeenCalledWith(
      expect.anything(),
      "u1",
      expect.objectContaining({ cardBrand: "visa", cardLast4: "4242", recurring: "month", currency: "usd" }),
    );
  });

  it("routes customer.subscription.deleted to a free-role update", async () => {
    stripeMock.webhooks.constructEventAsync.mockResolvedValue({
      type: "customer.subscription.deleted",
      data: { object: { customer: "cus_1", metadata: { clerkUserId: "u1" } } },
    });

    const res = await post("{}", "t=1,v1=abc");
    expect(res.status).toBe(200);
    expect(updateUserRoleMock).toHaveBeenCalledWith(expect.anything(), {
      clerkUserId: "u1",
      role: "free",
      stripeCustomerId: "cus_1",
    });
  });

  it("routes customer.subscription.updated to a role resolved from the new price", async () => {
    stripeMock.webhooks.constructEventAsync.mockResolvedValue({
      type: "customer.subscription.updated",
      data: {
        object: {
          customer: "cus_1",
          metadata: { clerkUserId: "u1" },
          items: { data: [{ price: { id: "price_proai_year" } }] },
        },
      },
    });

    const res = await post("{}", "t=1,v1=abc");
    expect(res.status).toBe(200);
    expect(updateUserRoleMock).toHaveBeenCalledWith(expect.anything(), {
      clerkUserId: "u1",
      role: "pro+ai",
      stripeCustomerId: "cus_1",
    });
  });
});
