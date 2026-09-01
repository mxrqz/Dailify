import { describe, it, expect } from "vitest";
import { QUOTAS, QUOTA_KEYS, limitsFor, quotaState, computeQuotas } from "./quotas";

describe("QUOTAS", () => {
  it("declara as três quotas com os limites da tabela", () => {
    expect(QUOTAS.tasks.limits).toEqual({ free: 30, pro: 300, "pro+ai": -1, admin: -1 });
    expect(QUOTAS.recurring.limits).toEqual({ free: 3, pro: 30, "pro+ai": -1, admin: -1 });
    expect(QUOTAS.voice.limits).toEqual({ free: 3, pro: 5, "pro+ai": 200, admin: -1 });
  });

  it("declara o escopo de cada quota", () => {
    expect(QUOTAS.tasks.scope).toBe("month");
    expect(QUOTAS.voice.scope).toBe("month");
    expect(QUOTAS.recurring.scope).toBe("lifetime");
  });

  it("QUOTA_KEYS cobre todas as chaves do registro", () => {
    expect(QUOTA_KEYS).toEqual(Object.keys(QUOTAS));
  });
});

describe("limitsFor", () => {
  it("free", () => {
    expect(limitsFor("free")).toEqual({ tasks: 30, recurring: 3, voice: 3 });
  });
  it("pro", () => {
    expect(limitsFor("pro")).toEqual({ tasks: 300, recurring: 30, voice: 5 });
  });
  it("pro+ai", () => {
    expect(limitsFor("pro+ai")).toEqual({ tasks: -1, recurring: -1, voice: 200 });
  });
  it("admin é ilimitado em tudo", () => {
    expect(limitsFor("admin")).toEqual({ tasks: -1, recurring: -1, voice: -1 });
  });
});

describe("quotaState", () => {
  it("finito no meio", () => {
    expect(quotaState(30, 12)).toEqual({
      limit: 30,
      used: 12,
      remaining: 18,
      unlimited: false,
      blocked: false,
      exhausted: false,
      ratio: 0.4,
    });
  });

  it("finito esgotado", () => {
    const s = quotaState(30, 30);
    expect(s.remaining).toBe(0);
    expect(s.exhausted).toBe(true);
    expect(s.ratio).toBe(1);
  });

  it("finito estourado não passa de 1 nem vai a negativo", () => {
    const s = quotaState(30, 47);
    expect(s.remaining).toBe(0);
    expect(s.ratio).toBe(1);
    expect(s.exhausted).toBe(true);
  });

  it("ilimitado não tem fração", () => {
    const s = quotaState(-1, 47);
    expect(s.unlimited).toBe(true);
    expect(s.blocked).toBe(false);
    expect(s.exhausted).toBe(false);
    expect(s.remaining).toBe(Infinity);
    expect(s.ratio).toBeNull();
  });

  it("bloqueado é cheio e esgotado", () => {
    const s = quotaState(0, 0);
    expect(s.blocked).toBe(true);
    expect(s.unlimited).toBe(false);
    expect(s.exhausted).toBe(true);
    expect(s.remaining).toBe(0);
    expect(s.ratio).toBe(1);
  });

  it("zero usado de um limite finito", () => {
    const s = quotaState(30, 0);
    expect(s.ratio).toBe(0);
    expect(s.exhausted).toBe(false);
  });
});

describe("computeQuotas", () => {
  it("combina limites e uso por chave", () => {
    const q = computeQuotas(
      { tasks: 30, recurring: 3, voice: 3 },
      { tasks: 12, recurring: 1, voice: 0 },
    );
    expect(q.loading).toBe(false);
    expect(q.states.tasks.remaining).toBe(18);
    expect(q.states.recurring.remaining).toBe(2);
    expect(q.states.voice.used).toBe(0);
  });

  it("sem limites = carregando, e nada aparece bloqueado", () => {
    const q = computeQuotas(undefined, undefined);
    expect(q.loading).toBe(true);
    for (const key of QUOTA_KEYS) {
      expect(q.states[key].exhausted).toBe(false);
      expect(q.states[key].unlimited).toBe(true);
    }
  });

  it("limites sem uso ainda é carregando", () => {
    expect(computeQuotas({ tasks: 30, recurring: 3, voice: 3 }, undefined).loading).toBe(true);
  });
});
