import type { MiddlewareHandler } from "hono";
import type { Env } from "../index";
import { fail } from "../lib/errors";

type Limiter = "API_LIMITER" | "VOICE_LIMITER" | "AUTH_LIMITER";

/**
 * Limite por usuário (não por IP: o usuário já está autenticado aqui, e IP compartilhado puniria
 * escritório inteiro). `VOICE_LIMITER` existe separado porque cada chamada de voz custa dinheiro
 * real em OpenAI — o limite dela é uma ordem de grandeza menor que o do resto da API.
 * `AUTH_LIMITER` é a exceção: antes do login não há usuário, então a chave é o IP.
 */
export function rateLimit(
  name: Limiter,
): MiddlewareHandler<{ Bindings: Env; Variables: { userId: string } }> {
  return async (c, next) => {
    const limiter = c.env[name];
    if (!limiter) return next(); // binding ausente (teste/dev local): nada a limitar
    const who = name === "AUTH_LIMITER" ? c.req.header("cf-connecting-ip") : c.get("userId");
    const { success } = await limiter.limit({ key: `${name}:${who}` });
    if (!success) return fail(c, 429, "Too many requests");
    await next();
  };
}
