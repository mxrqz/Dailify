import type { MiddlewareHandler } from "hono";
import { API_ERROR } from "@dailify/shared";
import type { AppEnv } from "../index";
import { fail } from "../lib/errors";

type Limiter = "API_LIMITER" | "VOICE_LIMITER" | "AUTH_LIMITER";

/**
 * Limite por usuário (não por IP: o usuário já está autenticado aqui, e IP compartilhado puniria
 * escritório inteiro). `VOICE_LIMITER` guards every OpenAI route (`/tasks/parse`, `/tasks/voice`,
 * `/mew/chat`), not only voice: each call costs real money, so its limit is an order of magnitude
 * below the rest of the API.
 * `AUTH_LIMITER` é a exceção: antes do login não há usuário, então a chave é o IP.
 */
export function rateLimit(name: Limiter): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const limiter = c.env[name];
    if (!limiter) return next(); // binding ausente (teste/dev local): nada a limitar
    const who = name === "AUTH_LIMITER" ? c.req.header("cf-connecting-ip") : c.get("userId");
    const { success } = await limiter.limit({ key: `${name}:${who}` });
    if (!success) return fail(c, 429, "Too many requests", { code: API_ERROR.rateLimited });
    await next();
  };
}
