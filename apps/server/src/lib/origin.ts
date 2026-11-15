import type { Env } from "../index";

// ALLOWED_ORIGIN é uma lista separada por vírgula; o primeiro é o padrão quando o Origin não vem.
export const allowedOrigins = (env: Env) => env.ALLOWED_ORIGIN.split(",").map((o) => o.trim());

// Volta do Stripe pro mesmo domínio de onde a pessoa saiu (dailify ou mewki).
export function appOrigin(env: Env, origin: string | undefined) {
  const list = allowedOrigins(env);
  return origin && list.includes(origin) ? origin : list[0];
}
