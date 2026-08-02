import { describe, it, expect } from "vitest";
import { PLAN_PERMISSIONS, computeEntitlements } from "./pricing";

describe("PLAN_PERMISSIONS", () => {
  it("free = 30 monthly, 0 recurring, no voice", () => {
    expect(PLAN_PERMISSIONS.free).toEqual({
      taskLimits: { monthly: 30, recurring: 0 },
      features: { voiceCreation: false },
    });
  });
  it("pro = 300 monthly, unlimited recurring, no voice", () => {
    expect(PLAN_PERMISSIONS.pro).toEqual({
      taskLimits: { monthly: 300, recurring: -1 },
      features: { voiceCreation: false },
    });
  });
  it("pro+ai = unlimited, voice on", () => {
    expect(PLAN_PERMISSIONS["pro+ai"]).toEqual({
      taskLimits: { monthly: -1, recurring: -1 },
      features: { voiceCreation: true },
    });
  });
});

describe("computeEntitlements", () => {
  it("free at limit cannot create", () => {
    const e = computeEntitlements(PLAN_PERMISSIONS.free, 30);
    expect(e.canCreateTask).toBe(false);
    expect(e.remaining).toBe(0);
    expect(e.recurrence).toBe(false); // recurring:0
  });
  it("free under limit can create", () => {
    expect(computeEntitlements(PLAN_PERMISSIONS.free, 5).canCreateTask).toBe(true);
  });
  it("pro is unlimited-recurrence but capped monthly", () => {
    const e = computeEntitlements(PLAN_PERMISSIONS.pro, 299);
    expect(e.recurrence).toBe(true);
    expect(e.unlimited).toBe(false);
    expect(e.canCreateTask).toBe(true);
  });
  it("undefined permissions = loading, premium off, creation not blocked", () => {
    const e = computeEntitlements(undefined, 0);
    expect(e.loading).toBe(true);
    expect(e.voice).toBe(false);
    expect(e.canCreateTask).toBe(true);
  });
});
