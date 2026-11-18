import { vi } from "vitest";

/**
 * The `stripe` module mock: every `new Stripe()` is this one object.
 *   vi.mock("stripe", () => import("./stripe"));
 *   import { stripeMock } from "./stripe";
 */
export const stripeMock = {
  checkout: { sessions: { create: vi.fn() } },
  billingPortal: { sessions: { create: vi.fn() } },
  subscriptions: { list: vi.fn(), retrieve: vi.fn(), search: vi.fn(), cancel: vi.fn() },
  invoices: { createPreview: vi.fn(), list: vi.fn() },
  webhooks: { constructEventAsync: vi.fn() },
};

function MockStripe() {
  return stripeMock;
}
MockStripe.createFetchHttpClient = () => ({});

export default MockStripe;
