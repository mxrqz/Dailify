import { describe, it, expect } from "vitest";

import { copy } from "./copy";

describe("auth copy", () => {
  it("não tem nenhuma string vazia", () => {
    expect(JSON.stringify(copy)).not.toMatch(/""/);
  });

  it("o rodapé legal difere entre entrar e criar conta", () => {
    expect(copy.signIn.legalPrefix).not.toBe(copy.signUp.legalPrefix);
  });
});
