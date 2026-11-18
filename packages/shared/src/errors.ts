/** The `code` beside an error's `error` text: the web branches on it, never on the message. */
export const API_ERROR = {
  rateLimited: "rate_limited",
  /** 403: the plan has no AI credits at all. */
  aiBlocked: "ai_blocked",
  /** 429: this month's AI credits are spent. */
  aiExhausted: "ai_exhausted",
  mewConsentRequired: "mew_consent_required",
  reconnect: "reconnect",
  alreadyLinked: "already_linked",
  missingScope: "missing_scope",
} as const;

export type ApiErrorCode = (typeof API_ERROR)[keyof typeof API_ERROR];

const CODES: readonly string[] = Object.values(API_ERROR);

export const isApiErrorCode = (value: unknown): value is ApiErrorCode =>
  typeof value === "string" && CODES.includes(value);
