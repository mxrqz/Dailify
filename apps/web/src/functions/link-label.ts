import { TASK_LIMITS, isCalendarEventLink, parseLinks } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";

const NAMES: Record<string, string> = {
  "meet.google.com": "Google Meet",
  "youtube.com": "YouTube",
  "www.youtube.com": "YouTube",
  "youtu.be": "YouTube",
  "github.com": "GitHub",
  "notion.so": "Notion",
  "www.notion.so": "Notion",
  "docs.google.com": "Google Docs",
  "zoom.us": "Zoom",
};

/** Nome do serviço quando conhecido, senão o próprio host sem "www." — nunca faz rede. */
export function linkLabel(url: string): string {
  if (!URL.canParse(url)) return url;
  // An event's `htmlLink` is www.google.com/calendar/event: the host alone would say "google.com".
  if (isCalendarEventLink(url)) return copy.calendar.name;
  const { hostname } = new URL(url);
  return NAMES[hostname] ?? linkHost(url);
}

/** The host without "www.", or "" for a broken URL. */
export const linkHost = (url: string): string =>
  URL.canParse(url) ? new URL(url).hostname.replace(/^www\./, "") : "";

/**
 * O que o campo de link aceita: a mesma regra do detector do composer, sem segunda definição.
 * `parseLinks` não cobre tamanho nem credencial embutida quando o esquema é explícito (fica pra
 * validação do servidor, por design dele) — replicados aqui pra não estourar um 400 só no salvar.
 */
export function normalizeUrl(raw: string): string | null {
  const input = raw.trim();
  const { urls } = parseLinks(input);
  if (urls.length !== 1) return null;
  // `parseLinks` apara pontuação final porque no composer a URL vem no meio de prosa ("(veja
  // x.com)"); aqui o campo só recebe URL, então token único com esquema explícito vale inteiro —
  // aparar corromperia ".../Java_(linguagem_de_programação)" e ".../path.".
  const url = /^https?:\/\/\S+$/i.test(input) ? input : urls[0];
  if (url.length > TASK_LIMITS.urlMax || !URL.canParse(url)) return null;
  const { username, password } = new URL(url);
  if (username || password) return null;
  return url;
}
