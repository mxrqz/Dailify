/**
 * Lógica pura das telas de auth. Fica fora do React de propósito: o repo não tem
 * @testing-library/react nem jsdom, então o que merece teste precisa ser função pura.
 * `use-email-link-auth.ts` é só o fio que liga o Clerk a este reducer.
 */

export type AuthMode = "signIn" | "signUp";

export type AuthErrorKey =
  "invalidEmail" | "blockedEmail" | "captcha" | "tooManyRequests" | "generic";

/** Um erro vira uma mensagem, ou um convite pra ir pra outra tela. */
export type AuthFailure =
  { kind: "message"; key: AuthErrorKey; code?: string } | { kind: "offer"; mode: AuthMode };

/** Um link já enviado, que a tela continua mostrando enquanto o reenvio não volta. */
export type SentLink = { email: string; sentAt: number };

export type AuthState =
  | { status: "idle" }
  // `resendOf` só existe quando este envio é um reenvio: a tela usa ele pra seguir na caixa de
  // entrada durante o round-trip, em vez de piscar de volta pro formulário.
  | { status: "sending"; resendOf?: SentLink }
  | ({ status: "awaitingLink" } & SentLink)
  | { status: "expired"; email: string }
  | { status: "error"; failure: AuthFailure }
  | { status: "verified" };

export type AuthAction =
  | { type: "submit" }
  | { type: "linkSent"; email: string; at: number }
  | { type: "expired" }
  | { type: "failed"; failure: AuthFailure }
  | { type: "verified" }
  | { type: "reset" };

export const initialAuthState: AuthState = { status: "idle" };

export const RESEND_COOLDOWN_MS = 30_000;

export function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "submit":
      // Retornar o mesmo objeto (e não um novo igual) faz o React pular o re-render.
      if (state.status === "sending") return state;
      return state.status === "awaitingLink"
        ? { status: "sending", resendOf: { email: state.email, sentAt: state.sentAt } }
        : { status: "sending" };
    case "linkSent":
      return state.status === "sending"
        ? { status: "awaitingLink", email: action.email, sentAt: action.at }
        : state;
    case "expired":
      return state.status === "awaitingLink" ? { status: "expired", email: state.email } : state;
    case "failed":
      return { status: "error", failure: action.failure };
    case "verified":
      return { status: "verified" };
    case "reset":
      return initialAuthState;
  }
}

/**
 * Traduz um `code` do Clerk numa falha que a tela sabe renderizar.
 *
 * `form_identifier_not_found` e `form_identifier_exists` só viram convite no modo em que são
 * inesperados — no outro modo eles são o caminho normal e nem chegam aqui.
 */
export function classifyClerkError(code: string, mode: AuthMode): AuthFailure {
  if (code === "form_identifier_not_found" && mode === "signIn") {
    return { kind: "offer", mode: "signUp" };
  }
  if (code === "form_identifier_exists" && mode === "signUp") {
    return { kind: "offer", mode: "signIn" };
  }
  if (code === "form_param_format_invalid") return { kind: "message", key: "invalidEmail" };
  if (code === "form_email_address_blocked") return { kind: "message", key: "blockedEmail" };
  if (code === "captcha_invalid" || code === "captcha_unavailable") {
    return { kind: "message", key: "captcha" };
  }
  if (code === "too_many_requests") return { kind: "message", key: "tooManyRequests" };
  return { kind: "message", key: "generic", code };
}

/** De onde o ProtectedRoute mandou o usuário — `location.state` é `unknown` por definição. */
export function redirectTarget(state: unknown): string {
  if (state === null || typeof state !== "object" || !("from" in state)) return "/dashboard";
  const { from } = state;
  if (from === null || typeof from !== "object") return "/dashboard";
  const pathname = "pathname" in from && typeof from.pathname === "string" ? from.pathname : "";
  const search = "search" in from && typeof from.search === "string" ? from.search : "";
  return pathname + search || "/dashboard";
}

export function canResend(sentAt: number, now: number): boolean {
  return now - sentAt >= RESEND_COOLDOWN_MS;
}
