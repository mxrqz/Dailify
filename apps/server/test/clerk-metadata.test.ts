import { describe, it, expect, vi, beforeEach } from "vitest";

const { updateUserMetadata } = vi.hoisted(() => ({ updateUserMetadata: vi.fn() }));

vi.mock("@clerk/backend", () => ({
  createClerkClient: () => ({ users: { updateUserMetadata } }),
}));

import { env } from "cloudflare:test";
import { updateUserRole } from "../src/lib/clerk";

beforeEach(() => vi.clearAllMocks());

describe("updateUserRole com usuário inexistente", () => {
  // O caminho que derrubava o webhook do Stripe: conta apagada no Clerk, invoice.paid ainda
  // chegando. Um throw aqui virava 500, o Stripe retentava e acabava desabilitando o endpoint —
  // e aí ninguém mais tinha o plano atualizado depois de pagar.
  it("engole o 404 do Clerk", async () => {
    updateUserMetadata.mockRejectedValue(Object.assign(new Error("not found"), { status: 404 }));
    await expect(
      updateUserRole(env, { clerkUserId: "gone", role: "pro", stripeCustomerId: "cus_1" }),
    ).resolves.toBeUndefined();
  });

  it("propaga qualquer outro erro", async () => {
    updateUserMetadata.mockRejectedValue(Object.assign(new Error("boom"), { status: 500 }));
    await expect(
      updateUserRole(env, { clerkUserId: "u1", role: "pro", stripeCustomerId: "cus_1" }),
    ).rejects.toThrow("boom");
  });
});
