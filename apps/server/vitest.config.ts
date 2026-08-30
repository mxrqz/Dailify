import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

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
          },
        },
      };
    }),
  ],
});
