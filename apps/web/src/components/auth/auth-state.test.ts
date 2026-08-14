import { describe, it, expect } from "vitest";

import {
  authReducer,
  canResend,
  classifyClerkError,
  initialAuthState,
  redirectTarget,
  RESEND_COOLDOWN_MS,
} from "./auth-state";

describe("authReducer", () => {
  it("submit sai de idle pra sending", () => {
    expect(authReducer(initialAuthState, { type: "submit" })).toEqual({ status: "sending" });
  });

  it("submit em sending não faz nada (evita disparo duplo)", () => {
    const sending = authReducer(initialAuthState, { type: "submit" });
    expect(authReducer(sending, { type: "submit" })).toBe(sending);
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

  it("expired só vale vindo de awaitingLink, e preserva o e-mail", () => {
    const awaiting = authReducer(authReducer(initialAuthState, { type: "submit" }), {
      type: "linkSent",
      email: "a@b.com",
      at: 1000,
    });
    expect(authReducer(awaiting, { type: "expired" })).toEqual({
      status: "expired",
      email: "a@b.com",
    });
    expect(authReducer(initialAuthState, { type: "expired" })).toBe(initialAuthState);
  });

  it("failed com mensagem vira error", () => {
    expect(
      authReducer(initialAuthState, {
        type: "failed",
        failure: { kind: "message", key: "invalidEmail" },
      }),
    ).toEqual({ status: "error", failure: { kind: "message", key: "invalidEmail" } });
  });

  it("failed com oferta guarda o modo oferecido", () => {
    expect(
      authReducer(initialAuthState, { type: "failed", failure: { kind: "offer", mode: "signUp" } }),
    ).toEqual({ status: "error", failure: { kind: "offer", mode: "signUp" } });
  });

  it("verified é terminal e alcançável de qualquer estado", () => {
    expect(authReducer(initialAuthState, { type: "verified" })).toEqual({ status: "verified" });
  });

  it("reset volta pra idle", () => {
    const sending = authReducer(initialAuthState, { type: "submit" });
    expect(authReducer(sending, { type: "reset" })).toEqual(initialAuthState);
  });
});

describe("classifyClerkError", () => {
  it("no /login, e-mail desconhecido oferece o cadastro", () => {
    expect(classifyClerkError("form_identifier_not_found", "signIn")).toEqual({
      kind: "offer",
      mode: "signUp",
    });
  });

  it("no /signup, e-mail conhecido oferece o login", () => {
    expect(classifyClerkError("form_identifier_exists", "signUp")).toEqual({
      kind: "offer",
      mode: "signIn",
    });
  });

  it("e-mail desconhecido no /signup não é oferta — é erro genérico", () => {
    expect(classifyClerkError("form_identifier_not_found", "signUp")).toEqual({
      kind: "message",
      key: "generic",
      code: "form_identifier_not_found",
    });
  });

  it("mapeia formato inválido, e-mail descartável, captcha e rate limit", () => {
    expect(classifyClerkError("form_param_format_invalid", "signIn")).toEqual({
      kind: "message",
      key: "invalidEmail",
    });
    expect(classifyClerkError("form_email_address_blocked", "signUp")).toEqual({
      kind: "message",
      key: "blockedEmail",
    });
    expect(classifyClerkError("captcha_invalid", "signUp")).toEqual({
      kind: "message",
      key: "captcha",
    });
    expect(classifyClerkError("captcha_unavailable", "signUp")).toEqual({
      kind: "message",
      key: "captcha",
    });
    expect(classifyClerkError("too_many_requests", "signIn")).toEqual({
      kind: "message",
      key: "tooManyRequests",
    });
  });

  it("código desconhecido cai no genérico e carrega o code pro relato de bug", () => {
    expect(classifyClerkError("some_new_clerk_code", "signIn")).toEqual({
      kind: "message",
      key: "generic",
      code: "some_new_clerk_code",
    });
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
  });
});

describe("canResend", () => {
  it("bloqueia dentro do cooldown e libera depois", () => {
    expect(canResend(1000, 1000)).toBe(false);
    expect(canResend(1000, 1000 + RESEND_COOLDOWN_MS - 1)).toBe(false);
    expect(canResend(1000, 1000 + RESEND_COOLDOWN_MS)).toBe(true);
  });
});
