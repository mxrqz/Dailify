import type { Span } from "./parse-task/spans";

// Curta de propósito: `ts`, `sh`, `py`, `rs`, `go` e `md` são TLDs reais E extensões de arquivo.
// Num app usado por quem escreve "main.ts" numa tarefa, a lista completa da IANA transformaria
// nome de arquivo em link. Errar pro lado de "não é link" é o certo aqui — não troque pela IANA.
// `so` e `be` entraram por notion.so/youtu.be (produtos reais, comuns em tarefa).
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

// Hosts de reunião/encurtador comuns em tarefa cujo TLD fica fora da allowlist (zoom.us, bit.ly…):
// entram pelo host (ou subdomínio dele, "us02web.zoom.us"), sem abrir o TLD inteiro.
const KNOWN_HOSTS = ["zoom.us", "bit.ly", "forms.gle", "goo.gl", "t.me", "wa.me", "cal.com"];

// Dentro da allowlist acima, `so` também é extensão de lib compilada (`libfoo.so`) — path ou
// query depois do host é o que distingue "notion.so/xyz" (link) de "libfoo.so" (arquivo).
const AMBIGUOUS_FILE_TLDS = ["so"];

const SCHEME_RE = /^https?:\/\//i;
const TRAILING_RE = /[.,;:!?)\]}'"]+$/;

function toAbsolute(candidate: string): string | null {
  const withScheme = SCHEME_RE.test(candidate) ? candidate : `https://${candidate}`;
  if (!URL.canParse(withScheme)) return null;

  const { protocol, hostname, pathname, search, username } = new URL(withScheme);
  if (protocol !== "http:" && protocol !== "https:") return null;

  // Sem esquema, "@" é e-mail (fulano@empresa.com), não link — a URL WHATWG lê como userinfo e
  // deixaria passar. Credencial em URL com esquema explícito (https://user:pass@host) fica pra
  // validação do servidor, não é problema deste detector.
  if (!SCHEME_RE.test(candidate) && username) return null;

  // Sem esquema e sem "www.", só passa com TLD da allowlist — é o que separa "youtube.com/x"
  // (link) de "main.ts" (nome de arquivo).
  if (!SCHEME_RE.test(candidate) && !/^www\./i.test(candidate)) {
    const host = hostname.toLowerCase();
    const known = KNOWN_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
    const tld = host.split(".").pop() ?? "";
    if (!known && !TLDS.includes(tld)) return null;
    if (AMBIGUOUS_FILE_TLDS.includes(tld) && pathname === "/" && !search) return null;
    // "update Monday.com board", "Booking.com": domínio nu com maiúscula é nome de produto
    // escrito à mão — link colado vem em minúscula ou com caminho.
    if (/^\p{Lu}/u.test(candidate) && pathname === "/" && !search) return null;
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

  // Vírgula só é ambígua em domínio nu ("a.com,b.com" colados = dois links). Com esquema explícito
  // o token já é link inequívoco — cortar na vírgula perderia dado real (coordenada "?q=lat,lng",
  // path "a,b/c"), então esse caso casa inteiro antes da vírgula entrar como separador.
  for (const match of input.matchAll(/https?:\/\/\S+|[^\s,]+/gi)) {
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

  // URL repetida vira um chip só (e uma linha só no D1); os spans ficam todos, senão a segunda
  // ocorrência sobra no título.
  return { urls: [...new Set(urls)], spans };
}

const VIDEO_HOSTS = [/^meet\.google\.com$/, /(^|\.)zoom\.us$/];

/** O primeiro link de Meet/Zoom: vira o `location` e dispensa criar outro Meet. */
export function videoLink(links: string[] = []): string | undefined {
  return links.find(
    (url) => URL.canParse(url) && VIDEO_HOSTS.some((re) => re.test(new URL(url).hostname)),
  );
}

/**
 * O primeiro link de sala do Meet (`meet.google.com/abc-defg-hij`): é o que vira o `conferenceData`
 * do evento — o código da sala é o `conferenceId` que o Google aceita.
 */
export function meetLink(links: string[] = []): string | undefined {
  return links.find(
    (url) =>
      URL.canParse(url) &&
      new URL(url).hostname === "meet.google.com" &&
      /^\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/.test(new URL(url).pathname),
  );
}

/** O `htmlLink` de um evento do Google Agenda — é ele, nos links da tarefa, que marca "já está lá". */
export function isCalendarEventLink(url: string): boolean {
  if (!URL.canParse(url)) return false;
  const { hostname, pathname } = new URL(url);
  return hostname === "www.google.com" && pathname === "/calendar/event";
}
