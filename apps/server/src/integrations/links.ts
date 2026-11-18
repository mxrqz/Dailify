import { TASK_LIMITS } from "@dailify/shared";

/** `added` go last; past the cap the oldest of the rest drop. */
export function appendLinks(current: string[] | undefined, added: string[]): string[] {
  const kept = (current ?? []).filter((l) => !added.includes(l));
  return [...kept.slice(0, Math.max(0, TASK_LIMITS.linksMax - added.length)), ...added];
}

/** `null` when `url` isn't there, so the caller skips the write. */
export function withoutLink(links: string[] | undefined, url: string | null): string[] | null {
  return links && url && links.includes(url) ? links.filter((l) => l !== url) : null;
}
