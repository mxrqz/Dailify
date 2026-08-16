import { describe, expect, it } from "vitest";
import { normalizeUrl } from "./links-field";

describe("aceita", () => {
  it("URL http(s) unica", () => {
    expect(normalizeUrl("meet.google.com/abc")).toBe("https://meet.google.com/abc");
  });
});

describe("rejeita", () => {
  it("texto sem URL", () => {
    expect(normalizeUrl("abc")).toBeNull();
  });

  it("mais de uma URL no mesmo rascunho", () => {
    expect(normalizeUrl("a.com b.com")).toBeNull();
  });

  it("credencial embutida com esquema explicito — mesma regra do servidor", () => {
    expect(normalizeUrl("https://user:pass@exemplo.com")).toBeNull();
  });

  it("URL acima do teto de 2048 caracteres — mesmo teto do servidor", () => {
    const long = `https://exemplo.com/${"a".repeat(2048)}`;
    expect(normalizeUrl(long)).toBeNull();
  });
});
