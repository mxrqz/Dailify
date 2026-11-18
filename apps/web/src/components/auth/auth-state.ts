/**
 * Lógica pura das telas de auth. Fica fora do React de propósito: o que merece teste precisa ser
 * função pura. `use-email-link-auth.ts` é só o fio que liga o Better Auth a este reducer.
 */
import { internalPath } from "@/lib/platform";

export type AuthMode = "signIn" | "signUp";

export type AuthErrorKey =
  "invalidEmail" | "captcha" | "tooManyRequests" | "network" | "reauth" | "generic";

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
  // `email` só existe quando a falha veio depois de um link já enviado (reenvio).
  | { status: "error"; failure: AuthFailure; email?: string };

export type AuthAction =
  | { type: "submit" }
  | { type: "linkSent"; email: string; at: number }
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
  return { key: "generic", code: error.code ?? String(error.status) };
}

/** De onde o ProtectedRoute mandou o usuário — `location.state` é `unknown` por definição. */
export function redirectTarget(state: unknown): string {
  if (state === null || typeof state !== "object" || !("from" in state)) return "/dashboard";
  const { from } = state;
  if (from === null || typeof from !== "object") return "/dashboard";
  const pathname = "pathname" in from && typeof from.pathname === "string" ? from.pathname : "";
  const search = "search" in from && typeof from.search === "string" ? from.search : "";
  return internalPath(pathname + search);
}

export function canResend(sentAt: number, now: number): boolean {
  return now - sentAt >= RESEND_COOLDOWN_MS;
}
