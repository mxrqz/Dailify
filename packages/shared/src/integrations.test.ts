import { describe, it, expect } from "vitest";
import { canUseIntegration, isProviderId, PROVIDER_IDS } from "./integrations";

describe("integrations", () => {
  it("Google Agenda vale em todo plano", () => {
    for (const role of ["free", "pro", "max", "admin"] as const)
      expect(canUseIntegration(role, "google-calendar")).toBe(true);
  });

  it("isProviderId só aceita chave própria do catálogo", () => {
    expect(isProviderId("google-calendar")).toBe(true);
    expect(isProviderId("toString")).toBe(false);
    expect(isProviderId(1)).toBe(false);
    expect(PROVIDER_IDS).toEqual(["google-calendar"]);
  });
});
