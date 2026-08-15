import type { Span } from "./parse-when";

// Curta de propósito: `ts`, `sh`, `py`, `rs`, `go` e `md` são TLDs reais E extensões de arquivo.
// Num app usado por quem escreve "main.ts" numa tarefa, a lista completa da IANA transformaria
// nome de arquivo em link. Errar pro lado de "não é link" é o certo aqui — não troque pela IANA.
// `so` e `be` entraram por notion.so/youtu.be (produtos reais, comuns em tarefa); `so` também é
// extensão de biblioteca (`libfoo.so`), mas é raro escrever isso numa tarefa do dia a dia.
const TLDS = [
  "com",
  "br",
  "org",
  "net",
  "io",
  "dev",
  "app",
  "me",
  "gg",
  "co",
  "ai",
  "xyz",
  "so",
  "be",
];

const SCHEME_RE = /^https?:\/\//i;
const TRAILING_RE = /[.,;:!?)\]}'"]+$/;

function toAbsolute(candidate: string): string | null {
  const withScheme = SCHEME_RE.test(candidate) ? candidate : `https://${candidate}`;
  if (!URL.canParse(withScheme)) return null;

  const { protocol, hostname } = new URL(withScheme);
  if (protocol !== "http:" && protocol !== "https:") return null;

  // Sem esquema e sem "www.", só passa com TLD da allowlist — é o que separa "youtube.com/x"
  // (link) de "main.ts" (nome de arquivo).
  if (!SCHEME_RE.test(candidate) && !/^www\./i.test(candidate)) {
    const tld = hostname.split(".").pop()?.toLowerCase();
    if (!tld || !TLDS.includes(tld)) return null;
  }

  return withScheme;
}

/**
 * Varre por token (separado por espaço) em vez de um regex de URL gigante: a decisão de "isso é
 * link?" fica em `toAbsolute`, testável e legível, e não num padrão de 200 caracteres.
 */
export function parseLinks(input: string): { urls: string[]; spans: Span[] } {
  const urls: string[] = [];
  const spans: Span[] = [];

  for (const match of input.matchAll(/\S+/g)) {
    const raw = match[0];
    const start = match.index ?? 0;

    const trimmed = raw.replace(TRAILING_RE, "").replace(/^[([{'"]+/, "");
    if (!trimmed.includes(".")) continue;

    const url = toAbsolute(trimmed);
    if (!url) continue;

    const offset = raw.indexOf(trimmed);
    urls.push(url);
    spans.push([start + offset, start + offset + trimmed.length]);
  }

  return { urls, spans };
}
