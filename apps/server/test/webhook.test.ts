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

import { env, applyD1Migrations } from "cloudflare:test";
import app from "../src/index";
import { seedUser } from "./session";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

/** O que o webhook grava: `plan`/`stripeCustomerId` na linha do Better Auth. */
const billingOf = (id: string) =>
  env.DB.prepare(`SELECT plan, stripeCustomerId FROM "user" WHERE id=?`).bind(id).first();

const post = (body: string, sig?: string) =>
  app.request(
    "/webhooks/stripe",
    { method: "POST", headers: sig ? { "stripe-signature": sig } : {}, body },
    env,
  );

/** An invoice line in the API shape (`2026-08-26.dahlia`): plan vs proration lives on `parent`. */
const line = (price: string, proration = false) => ({
  pricing: { price_details: { price, product: "prod_1" } },
  parent: { type: "subscription_item_details", subscription_item_details: { proration } },
});

const invoicePaid = (lines: unknown[]) => ({
  type: "invoice.paid",
  data: {
    object: {
      customer: "cus_1",
      parent: { subscription_details: { metadata: { clerkUserId: "u1" }, subscription: "sub_1" } },
      lines: { data: lines },
    },
  },
});

describe("POST /webhooks/stripe", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await seedUser(env.DB, "u1");
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

  it("routes invoice.paid to the plan + customer on the user row", async () => {
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
          lines: { data: [line("price_pro_month")] },
        },
      },
    });
    const res = await post("{}", "t=1,v1=abc");
    expect(res.status).toBe(200);
    expect(await billingOf("u1")).toEqual({ plan: "pro", stripeCustomerId: "cus_1" });
  });

  // Upgrade Pro -> Max: Stripe lists the proration lines (priced at the OLD plan) before the plan line.
  it("invoice.paid takes the plan from the non-proration line, not lines[0]", async () => {
    stripeMock.webhooks.constructEventAsync.mockResolvedValue(
      invoicePaid([
        line("price_pro_month", true),
        line("price_max_month", true),
        line("price_max_month"),
      ]),
    );
    await post("{}", "t=1,v1=abc");
    expect(await billingOf("u1")).toEqual({ plan: "max", stripeCustomerId: "cus_1" });
  });

  it("invoice.paid with only proration lines leaves the plan alone", async () => {
    await seedUser(env.DB, "u1", { plan: "pro", stripeCustomerId: "cus_1" });
    stripeMock.webhooks.constructEventAsync.mockResolvedValue(
      invoicePaid([line("price_max_month", true), line("price_pro_month", true)]),
    );
    await post("{}", "t=1,v1=abc");
    expect(await billingOf("u1")).toEqual({ plan: "pro", stripeCustomerId: "cus_1" });
  });

  it("invoice.paid with an unknown price doesn't downgrade a paying user", async () => {
    await seedUser(env.DB, "u1", { plan: "max", stripeCustomerId: "cus_1" });
    stripeMock.webhooks.constructEventAsync.mockResolvedValue(invoicePaid([line("price_legacy")]));
    await post("{}", "t=1,v1=abc");
    expect(await billingOf("u1")).toEqual({ plan: "max", stripeCustomerId: "cus_1" });
  });

  it("customer.subscription.updated with an unknown price doesn't downgrade a paying user", async () => {
    await seedUser(env.DB, "u1", { plan: "max", stripeCustomerId: "cus_1" });
    stripeMock.webhooks.constructEventAsync.mockResolvedValue({
      type: "customer.subscription.updated",
      data: {
        object: {
          customer: "cus_1",
          metadata: { clerkUserId: "u1" },
          items: { data: [{ price: { id: "price_legacy" } }] },
        },
      },
    });
    await post("{}", "t=1,v1=abc");
    expect(await billingOf("u1")).toEqual({ plan: "max", stripeCustomerId: "cus_1" });
  });

  it("routes customer.subscription.deleted to a free-role update", async () => {
    stripeMock.webhooks.constructEventAsync.mockResolvedValue({
      type: "customer.subscription.deleted",
      data: { object: { customer: "cus_1", metadata: { clerkUserId: "u1" } } },
    });

    const res = await post("{}", "t=1,v1=abc");
    expect(res.status).toBe(200);
    expect(await billingOf("u1")).toEqual({ plan: "free", stripeCustomerId: "cus_1" });
  });

  it("routes customer.subscription.updated to a role resolved from the new price", async () => {
    stripeMock.webhooks.constructEventAsync.mockResolvedValue({
      type: "customer.subscription.updated",
      data: {
        object: {
          customer: "cus_1",
          metadata: { clerkUserId: "u1" },
          items: { data: [{ price: { id: "price_max_year" } }] },
        },
      },
    });

    const res = await post("{}", "t=1,v1=abc");
    expect(res.status).toBe(200);
    expect(await billingOf("u1")).toEqual({ plan: "max", stripeCustomerId: "cus_1" });
  });

  it("a deleted user is a no-op, not a 500 (Stripe would retry and disable the endpoint)", async () => {
    stripeMock.webhooks.constructEventAsync.mockResolvedValue({
      type: "customer.subscription.deleted",
      data: { object: { customer: "cus_9", metadata: { clerkUserId: "gone" } } },
    });
    expect((await post("{}", "t=1,v1=abc")).status).toBe(200);
    expect(await billingOf("gone")).toBeNull();
  });

  it("an event without a customer keeps the one already saved", async () => {
    await seedUser(env.DB, "u1", { plan: "pro", stripeCustomerId: "cus_1" });
    stripeMock.webhooks.constructEventAsync.mockResolvedValue({
      type: "customer.subscription.deleted",
      data: { object: { customer: null, metadata: { clerkUserId: "u1" } } },
    });
    await post("{}", "t=1,v1=abc");
    expect(await billingOf("u1")).toEqual({ plan: "free", stripeCustomerId: "cus_1" });
  });
});
