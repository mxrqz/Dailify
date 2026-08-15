import { describe, expect, it } from "vitest";
import { parseLinks } from "./parse-links";

const urls = (input: string) => parseLinks(input).urls;

describe("aceita", () => {
  it.each([
    ["reunião https://meet.google.com/abc-defg", "https://meet.google.com/abc-defg"],
    ["ver http://exemplo.com", "http://exemplo.com"],
    ["ver www.youtube.com", "https://www.youtube.com"],
    ["assistir youtube.com/watch?v=aBc123", "https://youtube.com/watch?v=aBc123"],
    ["abrir dailify.mxrqz.com", "https://dailify.mxrqz.com"],
  ])("%j", (input, expected) => {
    expect(urls(input)).toEqual([expected]);
  });

  it("acha mais de um", () => {
    expect(urls("call meet.google.com/abc pauta em notion.so/xyz")).toEqual([
      "https://meet.google.com/abc",
      "https://notion.so/xyz",
    ]);
  });

  it("preserva a caixa do path", () => {
    expect(urls("ver youtu.be/AbC123")).toEqual(["https://youtu.be/AbC123"]);
  });
});

describe("ignora", () => {
  it.each([
    "editar o main.ts",
    "rodar o deploy.sh",
    "abrir index.html",
    "comprar 2.5kg de arroz",
    "reunião com o time",
    "custou R$ 19.90",
    "e-mail do fulano@empresa.com",
    "manda um email pra fulano@empresa.com sobre X",
    "contato joao.silva@gmail.com",
  ])("%j", (input) => {
    expect(urls(input)).toEqual([]);
  });
});

describe("pontuação", () => {
  it.each([
    ["veja youtube.com/abc.", "https://youtube.com/abc"],
    ["veja youtube.com/abc,", "https://youtube.com/abc"],
    ["veja (youtube.com/abc)", "https://youtube.com/abc"],
  ])("%j apara o final", (input, expected) => {
    expect(urls(input)).toEqual([expected]);
  });
});

describe("TLD ambiguo com extensao de arquivo (so)", () => {
  it("host pelado nao vira link", () => {
    expect(urls("compilar libfoo.so")).toEqual([]);
  });

  it("com path vira link", () => {
    expect(urls("revisar notion.so/xyz")).toEqual(["https://notion.so/xyz"]);
  });

  it("com query mas sem path vira link", () => {
    expect(urls("entrar em notion.so?ref=abc")).toEqual(["https://notion.so?ref=abc"]);
  });
});

describe("URLs coladas por virgula", () => {
  it("separa em dois links", () => {
    expect(urls("ver youtube.com/a,youtube.com/b")).toEqual([
      "https://youtube.com/a",
      "https://youtube.com/b",
    ]);
  });
});

describe("spans", () => {
  it("aponta pro trecho exato do original", () => {
    const input = "reunião meet.google.com/abc hoje";
    const [start, end] = parseLinks(input).spans[0];
    expect(input.slice(start, end)).toBe("meet.google.com/abc");
  });
});
