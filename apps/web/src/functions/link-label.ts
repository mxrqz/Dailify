import { isCalendarEventLink } from "@dailify/shared";

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
  return NAMES[hostname] ?? hostname.replace(/^www\./, "");
}
