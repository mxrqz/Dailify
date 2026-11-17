// Só para a CLI gerar o SQL do Better Auth (vira `migrations/0015_better_auth.sql`):
//   cd apps/server && bunx --bun auth@1.7.25 generate --config scripts/auth-schema.ts --output /tmp/auth.sql -y
// Banco em memória e env fictício: só o schema importa, nenhum binding é tocado na geração.
import { Database } from "bun:sqlite";
import { betterAuth } from "better-auth";
import { authOptions } from "../src/auth-options";
import type { Env } from "../src/index";

// `JSON.parse` devolve `any`: o stub entra como `Env` sem cast, e os bindings nunca são chamados.
const env: Env = JSON.parse(
  JSON.stringify({
    ALLOWED_ORIGIN: "https://mewki.mxrqz.com",
    BETTER_AUTH_URL: "https://api.mewki.mxrqz.com",
    BETTER_AUTH_SECRET: "x".repeat(32),
  }),
);

export const auth = betterAuth({ ...authOptions(env), database: new Database(":memory:") });
