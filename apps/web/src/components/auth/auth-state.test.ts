import { describe, it, expect } from "vitest";

import {
  authReducer,
  canResend,
  classifyAuthError,
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
});

describe("canResend", () => {
  it("bloqueia dentro do cooldown e libera depois", () => {
    expect(canResend(1000, 1000)).toBe(false);
    expect(canResend(1000, 1000 + RESEND_COOLDOWN_MS - 1)).toBe(false);
    expect(canResend(1000, 1000 + RESEND_COOLDOWN_MS)).toBe(true);
  });
});
