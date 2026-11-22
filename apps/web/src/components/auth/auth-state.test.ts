import { describe, it, expect } from "vitest";

import {
  authReducer,
  canResend,
  classifyAuthError,
  initialAuthState,
  carriedEmail,
  redirectTarget,
  RESEND_COOLDOWN_MS,
  withEmail,
} from "./auth-state";

describe("withEmail / carriedEmail", () => {
  it("adds the trimmed e-mail to the state and keeps the deep link", () => {
    const from = { pathname: "/billing", search: "" };
    const state = withEmail({ from }, " ana@x.com ");
    expect(state).toEqual({ from, email: "ana@x.com" });
    expect(carriedEmail(state)).toBe("ana@x.com");
    expect(redirectTarget(state)).toBe("/billing");
  });

  it("reads nothing from a missing or malformed state", () => {
    expect(carriedEmail(null)).toBe("");
    expect(carriedEmail({ email: 42 })).toBe("");
    expect(withEmail(null, "")).toEqual({ email: "" });
  });
});

describe("authReducer", () => {
  it("submit sai de idle pra sending", () => {
    expect(authReducer(initialAuthState, { type: "submit" })).toEqual({ status: "sending" });
  });

  it("submit em sending não faz nada (evita disparo duplo)", () => {
    const sending = authReducer(initialAuthState, { type: "submit" });
    expect(authReducer(sending, { type: "submit" })).toBe(sending);
  });

  it("submit vindo de awaitingLink carrega o link já enviado (reenvio não pisca)", () => {
    const awaiting = authReducer(authReducer(initialAuthState, { type: "submit" }), {
      type: "linkSent",
      email: "a@b.com",
      at: 1000,
    });
    expect(authReducer(awaiting, { type: "submit" })).toEqual({
      status: "sending",
      resendOf: { email: "a@b.com", sentAt: 1000 },
    });
  });

  it("submit vindo de idle não carrega link nenhum (primeiro envio mostra o formulário)", () => {
    expect(authReducer(initialAuthState, { type: "submit" })).not.toHaveProperty("resendOf");
  });

  it("linkSent depois de um reenvio troca o link carregado pelo novo", () => {
    const resending = authReducer(
      authReducer(authReducer(initialAuthState, { type: "submit" }), {
        type: "linkSent",
        email: "a@b.com",
        at: 1000,
      }),
      { type: "submit" },
    );
    expect(authReducer(resending, { type: "linkSent", email: "a@b.com", at: 90_000 })).toEqual({
      status: "awaitingLink",
      email: "a@b.com",
      sentAt: 90_000,
    });
  });

  it("linkSent só vale vindo de sending", () => {
    const sending = authReducer(initialAuthState, { type: "submit" });
    expect(authReducer(sending, { type: "linkSent", email: "a@b.com", at: 1000 })).toEqual({
      status: "awaitingLink",
      email: "a@b.com",
      sentAt: 1000,
    });
    expect(authReducer(initialAuthState, { type: "linkSent", email: "a@b.com", at: 1000 })).toBe(
      initialAuthState,
    );
  });

  it("failed vira error com a falha", () => {
    expect(
      authReducer(initialAuthState, { type: "failed", failure: { key: "invalidEmail" } }),
    ).toEqual({ status: "error", failure: { key: "invalidEmail" } });
  });

  it("failed vindo de awaitingLink preserva o e-mail (reenvio não zera o formulário)", () => {
    const awaiting = authReducer(authReducer(initialAuthState, { type: "submit" }), {
      type: "linkSent",
      email: "a@b.com",
      at: 1000,
    });
    expect(
      authReducer(awaiting, {
        type: "failed",
        failure: { key: "tooManyRequests" },
      }),
    ).toEqual({
      status: "error",
      failure: { key: "tooManyRequests" },
      email: "a@b.com",
    });
  });

  it("failed com o reenvio em voo (sending.resendOf) também preserva o e-mail", () => {
    const resending = authReducer(
      authReducer(authReducer(initialAuthState, { type: "submit" }), {
        type: "linkSent",
        email: "a@b.com",
        at: 1000,
      }),
      { type: "submit" },
    );
    expect(
      authReducer(resending, {
        type: "failed",
        failure: { key: "tooManyRequests" },
      }),
    ).toEqual({
      status: "error",
      failure: { key: "tooManyRequests" },
      email: "a@b.com",
    });
  });

  it("failed no primeiro envio não inventa e-mail nenhum", () => {
    const sending = authReducer(initialAuthState, { type: "submit" });
    // `toEqual` ignora chave com valor `undefined`, então isto falha se um e-mail aparecer.
    expect(authReducer(sending, { type: "failed", failure: { key: "invalidEmail" } })).toEqual({
      status: "error",
      failure: { key: "invalidEmail" },
    });
  });

  it("reset volta pra idle", () => {
    const sending = authReducer(initialAuthState, { type: "submit" });
    expect(authReducer(sending, { type: "reset" })).toEqual(initialAuthState);
  });
});

describe("classifyAuthError", () => {
  it("fetch que lançou (sem resposta) é rede", () => {
    expect(classifyAuthError(null)).toEqual({ key: "network" });
  });

  it("429 é rate limit, venha o código que vier", () => {
    expect(classifyAuthError({ status: 429 })).toEqual({ key: "tooManyRequests" });
    expect(classifyAuthError({ status: 429, code: "TOO_MANY_REQUESTS" })).toEqual({
      key: "tooManyRequests",
    });
  });

  it("validação do corpo é e-mail inválido", () => {
    expect(classifyAuthError({ status: 400, code: "VALIDATION_ERROR" })).toEqual({
      key: "invalidEmail",
    });
  });

  it("token do Turnstile ausente ou recusado é captcha", () => {
    expect(classifyAuthError({ status: 400, code: "MISSING_RESPONSE" })).toEqual({
      key: "captcha",
    });
    expect(classifyAuthError({ status: 403, code: "VERIFICATION_FAILED" })).toEqual({
      key: "captcha",
    });
  });

  it("o resto cai no genérico e carrega o código (ou o status) pro relato de bug", () => {
    expect(classifyAuthError({ status: 500, code: "SOMETHING_NEW" })).toEqual({
      key: "generic",
      code: "SOMETHING_NEW",
    });
    expect(classifyAuthError({ status: 502 })).toEqual({ key: "generic", code: "502" });
  });

  it("tells a mistyped code from one only a new e-mail replaces", () => {
    expect(classifyAuthError({ status: 400, code: "INVALID_OTP" })).toEqual({
      key: "invalidCode",
    });
    expect(classifyAuthError({ status: 400, code: "OTP_EXPIRED" })).toEqual({ key: "staleCode" });
    expect(classifyAuthError({ status: 403, code: "TOO_MANY_ATTEMPTS" })).toEqual({
      key: "staleCode",
    });
  });

  it("maps the second factor's codes, including a sign-in left too long", () => {
    for (const code of ["INVALID_CODE", "INVALID_BACKUP_CODE"])
      expect(classifyAuthError({ status: 401, code })).toEqual({ key: "invalidCode" });
    for (const code of ["OTP_HAS_EXPIRED", "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE"])
      expect(classifyAuthError({ status: 400, code })).toEqual({ key: "staleCode" });
    expect(classifyAuthError({ status: 401, code: "INVALID_TWO_FACTOR_COOKIE" })).toEqual({
      key: "staleChallenge",
    });
  });

  it("maps the password answers, the breach check and an unconfirmed e-mail", () => {
    expect(classifyAuthError({ status: 401, code: "INVALID_EMAIL_OR_PASSWORD" })).toEqual({
      key: "wrongPassword",
    });
    expect(classifyAuthError({ status: 400, code: "PASSWORD_TOO_SHORT" })).toEqual({
      key: "passwordRules",
    });
    expect(classifyAuthError({ status: 400, code: "password_compromised" })).toEqual({
      key: "passwordCompromised",
    });
    expect(classifyAuthError({ status: 403, code: "EMAIL_NOT_VERIFIED" })).toEqual({
      key: "emailNotVerified",
    });
  });

  it("reads a failed or cancelled passkey ceremony as passkeyFailed", () => {
    for (const code of ["ERROR_CEREMONY_ABORTED", "AUTH_CANCELLED", "PASSKEY_NOT_FOUND"])
      expect(classifyAuthError({ status: 400, code })).toEqual({ key: "passkeyFailed" });
  });
});

describe("authReducer verifySent", () => {
  it("shows the confirmation inbox only after a send in flight", () => {
    const sending = authReducer(initialAuthState, { type: "submit" });
    expect(authReducer(sending, { type: "verifySent", email: "a@b.c" })).toEqual({
      status: "verifySent",
      email: "a@b.c",
    });
    expect(authReducer(initialAuthState, { type: "verifySent", email: "a@b.c" })).toBe(
      initialAuthState,
    );
  });
});

describe("redirectTarget", () => {
  it("extrai pathname + search do state do ProtectedRoute", () => {
    expect(redirectTarget({ from: { pathname: "/profile", search: "?tab=premium" } })).toBe(
      "/profile?tab=premium",
    );
  });

  it("aceita pathname sem search", () => {
    expect(redirectTarget({ from: { pathname: "/profile", search: "" } })).toBe("/profile");
  });

  it("cai em /dashboard pra todo formato inesperado", () => {
    expect(redirectTarget(null)).toBe("/dashboard");
    expect(redirectTarget(undefined)).toBe("/dashboard");
    expect(redirectTarget("string")).toBe("/dashboard");
    expect(redirectTarget({})).toBe("/dashboard");
    expect(redirectTarget({ from: null })).toBe("/dashboard");
    expect(redirectTarget({ from: "x" })).toBe("/dashboard");
    expect(redirectTarget({ from: {} })).toBe("/dashboard");
    expect(redirectTarget({ from: { pathname: 42 } })).toBe("/dashboard");
    // Nada que saia do site: protocol-relative, com barra invertida, ou sem barra nenhuma.
    expect(redirectTarget({ from: { pathname: "//evil.com" } })).toBe("/dashboard");
    expect(redirectTarget({ from: { pathname: "//evil.com", search: "?x=1" } })).toBe("/dashboard");
    expect(redirectTarget({ from: { pathname: "/\\evil.com" } })).toBe("/dashboard");
    expect(redirectTarget({ from: { pathname: "https://evil.com" } })).toBe("/dashboard");
  });

  it("resumes an MCP client's signed authorize query on the consent page", () => {
    const search = "?client_id=c1&scope=openid&exp=1&sig=abc";
    expect(redirectTarget({ from: { pathname: "/billing" } }, search)).toBe(
      `/oauth/consent${search}`,
    );
    expect(redirectTarget(null, "?error=SESSION_EXPIRED")).toBe("/dashboard");
  });
});

describe("canResend", () => {
  it("bloqueia dentro do cooldown e libera depois", () => {
    expect(canResend(1000, 1000)).toBe(false);
    expect(canResend(1000, 1000 + RESEND_COOLDOWN_MS - 1)).toBe(false);
    expect(canResend(1000, 1000 + RESEND_COOLDOWN_MS)).toBe(true);
  });
});
