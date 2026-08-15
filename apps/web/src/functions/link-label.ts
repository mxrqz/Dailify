const NAMES: Record<string, string> = {
  "meet.google.com": "Google Meet",
  "youtube.com": "YouTube",
  "www.youtube.com": "YouTube",
  "youtu.be": "YouTube",
  "github.com": "GitHub",
  "notion.so": "Notion",
  "www.notion.so": "Notion",
  "calendar.google.com": "Google Agenda",
  "docs.google.com": "Google Docs",
  "zoom.us": "Zoom",
};

/** Nome do serviço quando conhecido, senão o próprio host sem "www." — nunca faz rede. */
export function linkLabel(url: string): string {
  if (!URL.canParse(url)) return url;
  const { hostname } = new URL(url);
  return NAMES[hostname] ?? hostname.replace(/^www\./, "");
}
