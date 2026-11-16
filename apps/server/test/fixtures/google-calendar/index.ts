// Respostas reais do Google, reduzidas ao que o servidor lê.
export const EVENTS_SCOPE = "https://www.googleapis.com/auth/calendar.events.owned";

export const token = {
  access_token: "ya29.access-1",
  expires_in: 3599,
  refresh_token: "1//refresh-1",
  // O Google expande "email" para a URL do userinfo.email.
  scope: `openid https://www.googleapis.com/auth/userinfo.email ${EVENTS_SCOPE}`,
  token_type: "Bearer",
  id_token: "eyJhbGciOiJSUzI1NiJ9.e30.sig",
};

export const tokenWithoutCalendar = {
  ...token,
  scope: "openid https://www.googleapis.com/auth/userinfo.email",
};

export const refreshed = {
  access_token: "ya29.access-2",
  expires_in: 3599,
  scope: token.scope,
  token_type: "Bearer",
};

export const invalidGrant = {
  error: "invalid_grant",
  error_description: "Token has been expired or revoked.",
};

export const userinfo = { sub: "1098765", email: "pessoa@gmail.com", email_verified: true };

export const EVENTS = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export const event = {
  kind: "calendar#event",
  status: "confirmed",
  htmlLink: "https://www.google.com/calendar/event?eid=abc123",
  hangoutLink: "https://meet.google.com/abc-defg-hij",
};

export const eventExists = {
  error: { code: 409, message: "The requested identifier already exists." },
};

export const rateLimited = {
  error: { code: 429, message: "Rate Limit Exceeded", errors: [{ reason: "rateLimitExceeded" }] },
};
