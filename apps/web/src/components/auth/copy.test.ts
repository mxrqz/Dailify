import { describe, it, expect } from "vitest";

import { copy } from "./copy";

describe("auth copy", () => {
  it("tem todas as seções", () => {
    for (const section of ["shell", "signIn", "signUp", "inbox", "verify", "errors"] as const) {
      expect(copy[section]).toBeTruthy();
    }
  });

  it("não tem nenhuma string vazia", () => {
    expect(JSON.stringify(copy)).not.toMatch(/""/);
  });

  it("cobre toda AuthErrorKey", () => {
    for (const key of [
      "invalidEmail",
      "blockedEmail",
      "captcha",
      "tooManyRequests",
      "expiredLink",
      "generic",
    ] as const) {
      expect(copy.errors[key]).toBeTruthy();
    }
  });

  it("o rodapé legal difere entre entrar e criar conta", () => {
    expect(copy.signIn.legalPrefix).not.toBe(copy.signUp.legalPrefix);
  });
});
