/**
 * Lógica pura das telas de auth. Fica fora do React de propósito: o que merece teste precisa ser
 * função pura. `use-email-link-auth.ts` é só o fio que liga o Better Auth a este reducer.
 */
import { API_ERROR, isRecord } from "@dailify/shared";

import { internalPath } from "@/lib/platform";

export type AuthMode = "signIn" | "signUp";

export type AuthErrorKey =
  | "invalidEmail"
  | "captcha"
  | "tooManyRequests"
  | "network"
  | "reauth"
  | "invalidCode"
  | "staleCode"
  | "wrongPassword"
  | "passwordRules"
  | "passwordCompromised"
  | "emailNotVerified"
  | "staleChallenge"
  | "generic";

/** `code` só no genérico: a tela mostra em mono pra virar relato de bug. */
export type AuthFailure = { key: AuthErrorKey; code?: string };

/** Um link já enviado, que a tela continua mostrando enquanto o reenvio não volta. */
export type SentLink = { email: string; sentAt: number };

export type AuthState =
  | { status: "idle" }
  // `resendOf` só existe quando este envio é um reenvio: a tela usa ele pra seguir na caixa de
  // entrada durante o round-trip, em vez de piscar de volta pro formulário.
  | { status: "sending"; resendOf?: SentLink }
  | ({ status: "awaitingLink" } & SentLink)
  // Sign-up with a password: the confirmation link is in the inbox, and no session exists yet.
  | { status: "verifySent"; email: string }
  // `email` só existe quando a falha veio depois de um link já enviado (reenvio).
  | { status: "error"; failure: AuthFailure; email?: string };

export type AuthAction =
  | { type: "submit" }
  | { type: "linkSent"; email: string; at: number }
  | { type: "verifySent"; email: string }
  | { type: "failed"; failure: AuthFailure }
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
    case "verifySent":
      return state.status === "sending" ? { status: "verifySent", email: action.email } : state;
    case "failed": {
      // Um reenvio que falha desmonta a CheckInbox e devolve o formulário: sem carregar o e-mail,
      // ele volta em branco e o usuário perde o endereço — e o link válido que ainda está na caixa.
      const email =
        state.status === "awaitingLink"
          ? state.email
          : state.status === "sending"
            ? state.resendOf?.email
            : undefined;
      return { status: "error", failure: action.failure, email };
    }
    case "reset":
      return initialAuthState;
  }
}

/** O `error` que o cliente do Better Auth devolve (`{ data, error }`), ou só a parte que importa. */
export type BetterAuthError = { status: number; code?: string };

/**
 * Traduz o erro do envio do link numa falha que a tela sabe renderizar. `null` = a requisição nem
 * saiu (o fetch lançou): rede.
 */
export function classifyAuthError(error: BetterAuthError | null): AuthFailure {
  if (!error) return { key: "network" };
  if (error.status === 429) return { key: "tooManyRequests" };
  // VALIDATION_ERROR: o zod do servidor só valida o `email` no corpo do magic link.
  if (error.code === "VALIDATION_ERROR" || error.code === "INVALID_EMAIL") {
    return { key: "invalidEmail" };
  }
  // Códigos do plugin `captcha` (token ausente, recusado pela Cloudflare ou já gasto).
  if (error.code === "MISSING_RESPONSE" || error.code === "VERIFICATION_FAILED") {
    return { key: "captcha" };
  }
  // The e-mailed code (`emailOTP`): a typo, or a code that only a new e-mail can replace.
  if (error.code === "INVALID_OTP") return { key: "invalidCode" };
  if (error.code === "OTP_EXPIRED" || error.code === "TOO_MANY_ATTEMPTS") {
    return { key: "staleCode" };
  }
  // Second factor (`twoFactor`): a typo, a code past its time, or a sign-in left too long.
  if (error.code === "INVALID_CODE" || error.code === "INVALID_BACKUP_CODE") {
    return { key: "invalidCode" };
  }
  if (error.code === "OTP_HAS_EXPIRED" || error.code === "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE") {
    return { key: "staleCode" };
  }
  if (error.code === "INVALID_TWO_FACTOR_COOKIE") return { key: "staleChallenge" };
  // Password. The server never says which half of e-mail + password was wrong.
  if (error.code === "INVALID_EMAIL_OR_PASSWORD" || error.code === "INVALID_PASSWORD") {
    return { key: "wrongPassword" };
  }
  if (error.code === "PASSWORD_TOO_SHORT" || error.code === "PASSWORD_TOO_LONG") {
    return { key: "passwordRules" };
  }
  if (error.code === API_ERROR.passwordCompromised) return { key: "passwordCompromised" };
  // Better Auth mails a fresh confirmation link along with this answer.
  if (error.code === "EMAIL_NOT_VERIFIED") return { key: "emailNotVerified" };
  return { key: "generic", code: error.code ?? String(error.status) };
}

/**
 * De onde o ProtectedRoute mandou o usuário — `location.state` é `unknown` por definição. A login
 * opened by an MCP client's authorize carries its signed query (`sig`): after sign-in it goes on
 * to the consent page with that same query.
 */
export function redirectTarget(state: unknown, query = ""): string {
  if (new URLSearchParams(query).has("sig")) return `/oauth/consent${query}`;
  if (state === null || typeof state !== "object" || !("from" in state)) return "/dashboard";
  const { from } = state;
  if (from === null || typeof from !== "object") return "/dashboard";
  const pathname = "pathname" in from && typeof from.pathname === "string" ? from.pathname : "";
  const search = "search" in from && typeof from.search === "string" ? from.search : "";
  return internalPath(pathname + search);
}

// The login <-> signup cross-link carries the typed e-mail in router state, never in the URL.
export function withEmail(state: unknown, email: string): object {
  return { ...(typeof state === "object" && state !== null ? state : {}), email: email.trim() };
}

export function carriedEmail(state: unknown): string {
  if (state === null || typeof state !== "object" || !("email" in state)) return "";
  return typeof state.email === "string" ? state.email : "";
}

/** A first factor that passed but holds the session back until the second (`twoFactor`). */
export const needsSecondFactor = (data: unknown): boolean =>
  isRecord(data) && data.twoFactorRedirect === true;

/** `/two-factor`, carrying where the sign-in was headed. */
export const secondFactorPath = (from: string): string =>
  `/two-factor?next=${encodeURIComponent(from)}`;

export function canResend(sentAt: number, now: number): boolean {
  return now - sentAt >= RESEND_COOLDOWN_MS;
}
