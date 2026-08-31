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
    LIVE_PRICE_PROAI: env.STRIPE_PRICE_PROAI,
    LIVE_PRICE_PROAI_YEAR: env.STRIPE_PRICE_PROAI_YEAR,
  };
  if (!key?.startsWith("sk_") || Object.values(ids).some((id) => !id)) return {};

  return { LIVE_STRIPE_SECRET_KEY: key, ...(ids as Record<string, string>) };
}

export default defineConfig({
  // Silences Vite's "Sourcemap ... points to missing source files" warning: the `stripe` package's
  // published .js.map files reference original .ts sources it doesn't ship. Cosmetic only — our own
  // sourcemaps are unaffected.
  logLevel: "error",
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations(path.join(__dirname, "migrations"));
      return {
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          bindings: {
            // Test-only binding so tests can apply migrations themselves (see beforeAll in tests).
            TEST_MIGRATIONS: migrations,
            // Dummy, syntactically-valid Clerk keys so clerkMiddleware() initializes in tests.
            // No token is ever sent in this phase's tests, so no real Clerk network call happens.
            CLERK_SECRET_KEY: "sk_test_00000000000000000000000000000000000000000000",
            CLERK_PUBLISHABLE_KEY: "pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk",
            // Svix secret de teste — o webhook do Clerk é assinado com ele em clerk-webhook.test.ts.
            CLERK_WEBHOOK_SECRET: "whsec_dGVzdHNlY3JldA==",
            // Par VAPID do exemplo da RFC 8291: chaves P-256 reais, mas de domínio público. O envio
            // em si é mockado nos testes; elas só precisam existir e ter o formato certo.
            VAPID_PUBLIC_KEY:
              "BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8",
            VAPID_PRIVATE_KEY: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
            VAPID_SUBJECT: "mailto:test@dailify.local",
            // Stripe is mocked in billing tests (vi.mock("stripe")) — these are just deterministic
            // price-id fixtures, no real Stripe network call happens.
            STRIPE_SECRET_KEY: "sk_test_stripe",
            STRIPE_WEBHOOK_SECRET: "whsec_test",
            STRIPE_PRICE_PRO: "price_pro_month",
            STRIPE_PRICE_PRO_YEAR: "price_pro_year",
            STRIPE_PRICE_PROAI: "price_proai_month",
            STRIPE_PRICE_PROAI_YEAR: "price_proai_year",
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
