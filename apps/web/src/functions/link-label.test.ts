import { describe, expect, it } from "vitest";
import { linkHost, linkLabel, normalizeUrl } from "./link-label";

describe("linkLabel", () => {
  it.each([
    ["https://meet.google.com/abc", "Google Meet"],
    ["https://youtu.be/xyz", "YouTube"],
    ["https://www.youtube.com/watch?v=1", "YouTube"],
    ["https://dailify.mxrqz.com/x", "dailify.mxrqz.com"],
    ["https://www.exemplo.com", "exemplo.com"],
    ["https://www.google.com/calendar/event?eid=abc", "Agenda"],
  ])("%s → %s", (url, expected) => {
    expect(linkLabel(url)).toBe(expected);
  });

  it("url quebrada volta ela mesma em vez de estourar", () => {
    expect(linkLabel("não é url")).toBe("não é url");
  });
});

describe("linkHost", () => {
  it("drops www. and gives an empty string for a broken URL", () => {
    expect(linkHost("https://www.exemplo.com/a")).toBe("exemplo.com");
    expect(linkHost("não é url")).toBe("");
  });
});

describe("normalizeUrl aceita", () => {
  it("URL http(s) unica", () => {
    expect(normalizeUrl("meet.google.com/abc")).toBe("https://meet.google.com/abc");
  });

  it("parentese final faz parte da URL quando o esquema e explicito", () => {
    const url = "https://pt.wikipedia.org/wiki/Java_(linguagem_de_programação)";
    expect(normalizeUrl(url)).toBe(url);
  });

  it("ponto final faz parte da URL quando o esquema e explicito", () => {
    expect(normalizeUrl("https://exemplo.com/path.")).toBe("https://exemplo.com/path.");
  });

  it("sem esquema, mantem o aparo de pontuacao do composer", () => {
    expect(normalizeUrl("(exemplo.com)")).toBe("https://exemplo.com");
  });
});

describe("normalizeUrl rejeita", () => {
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
