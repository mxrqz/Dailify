import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

/**
 * O vitest roda em Node e não herda o `.env` do diretório sozinho — e `vite` (que teria `loadEnv`)
 * não é dependência deste app. Oito linhas de parser resolvem: `KEY=valor`, sem interpolação.
 */
function readEnvFile(): Record<string, string> {
  try {
    const out: Record<string, string> = {};
    for (const line of readFileSync(path.join(__dirname, ".env"), "utf8").split("\n")) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (match) out[match[1]] = match[2].trim().replace(/^["\']|["\']$/g, "");
    }
    return out;
  } catch {
    return {}; // sem .env (CI, clone limpo): o teste de preço se pula
  }
}

/**
 * O que o teste de preço precisa e os fixtures não podem dar: a chave e os price ids de verdade.
 * Só entra o que já está no ambiente — em CI sem segredo, nada, e o teste se pula sozinho.
 */
function liveStripeBindings(): Record<string, string> {
  const env = { ...readEnvFile(), ...process.env };

  const key = env.STRIPE_SECRET_KEY;
  const ids = {
    LIVE_PRICE_PRO: env.STRIPE_PRICE_PRO,
    LIVE_PRICE_PRO_YEAR: env.STRIPE_PRICE_PRO_YEAR,
    LIVE_PRICE_MAX: env.STRIPE_PRICE_MAX,
    LIVE_PRICE_MAX_YEAR: env.STRIPE_PRICE_MAX_YEAR,
  };
  const live = Object.entries(ids).filter((e): e is [string, string] => !!e[1]);
  if (!key?.startsWith("sk_") || live.length < 4) return {};

  return { LIVE_STRIPE_SECRET_KEY: key, ...Object.fromEntries(live) };
}

export default defineConfig({
  // Silences Vite's "Sourcemap ... points to missing source files" warning: the `stripe` package's
  // published .js.map files reference original .ts sources it doesn't ship. Cosmetic only — our own
  // sourcemaps are unaffected.
  logLevel: "error",
  test: {
    setupFiles: ["./test/apply-migrations.ts"],
    // Calls cleared and spies/globals restored per test, so no hand-written vi.clearAllMocks().
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
  },
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations(path.join(__dirname, "migrations"));
      return {
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          bindings: {
            // Test-only binding so tests can apply migrations themselves (test/apply-migrations.ts, the setupFiles entry).
            TEST_MIGRATIONS: migrations,
            // Fixo: senão o .env local (localhost) vaza pros testes de CORS/redirect do Stripe.
            ALLOWED_ORIGIN: "https://dailify.mxrqz.com,https://mewki.mxrqz.com",
            // Better Auth de verdade sobre o D1 de teste (magic-link.test.ts). O e-mail é mockado
            // (vi.mock de lib/email) e o captcha só roda no handler HTTP, não no `auth.api`.
            BETTER_AUTH_SECRET: "test-secret-0123456789abcdefghijklmnopqrstuvwxyz",
            BETTER_AUTH_URL: "https://api.mewki.mxrqz.com",
            TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
            // Par VAPID do exemplo da RFC 8291: chaves P-256 reais, mas de domínio público. O envio
            // em si é mockado nos testes; elas só precisam existir e ter o formato certo.
            VAPID_PUBLIC_KEY:
              "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
            VAPID_PRIVATE_KEY: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
            VAPID_SUBJECT: "mailto:test@dailify.local",
            // Stripe is mocked in billing tests (vi.mock("stripe")) — these are just deterministic
            // price-id fixtures, no real Stripe network call happens.
            STRIPE_SECRET_KEY: "sk_test_stripe",
            // The local .env holds a real key: without this fake an unmocked path bills OpenAI.
            OPENAI_API_KEY: "sk-test-openai",
            STRIPE_WEBHOOK_SECRET: "whsec_test",
            STRIPE_PRICE_PRO: "price_pro_month",
            STRIPE_PRICE_PRO_YEAR: "price_pro_year",
            STRIPE_PRICE_MAX: "price_max_month",
            STRIPE_PRICE_MAX_YEAR: "price_max_year",
            // Integrações: o HTTP do Google é mockado (fetch); a chave são os bytes 0..31.
            GOOGLE_CLIENT_ID: "test-client.apps.googleusercontent.com",
            GOOGLE_CLIENT_SECRET: "test-google-secret",
            TOKEN_KEY_V1: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=",
            // Credenciais REAIS, quando existirem no ambiente (bun carrega o .env daqui), em
            // bindings separadas: `pricing-stripe.test.ts` compara o preço anunciado com o cobrado,
            // e os testes mockados continuam vendo os fixtures acima. Sem elas, aquele teste pula.
            ...liveStripeBindings(),
          },
        },
      };
    }),
  ],
});
