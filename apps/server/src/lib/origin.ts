import type { Env } from "../index";

// ALLOWED_ORIGIN é uma lista separada por vírgula; o primeiro é o padrão quando o Origin não vem.
export const allowedOrigins = (env: Env) => env.ALLOWED_ORIGIN.split(",").map((o) => o.trim());

// The Tauri app calls from its own origins; `mewki://` is its deep link back.
export const NATIVE_ORIGINS = [
  "tauri://localhost",
  "http://tauri.localhost",
  "https://tauri.localhost",
  "mewki://",
];

// Volta do Stripe pro mesmo domínio de onde a pessoa saiu (dailify ou mewki).
export function appOrigin(env: Env, origin: string | undefined) {
  const list = allowedOrigins(env);
  return origin && list.includes(origin) ? origin : list[0];
}

// Stripe can't send a browser back into the app, so the app returns via the web `/app/*` page,
// which hands the rest of the path to the app (App Link or `mewki://open`).
export function returnBase(env: Env, origin: string | undefined) {
  return origin && NATIVE_ORIGINS.includes(origin)
    ? `${allowedOrigins(env)[0]}/app`
    : appOrigin(env, origin);
}
