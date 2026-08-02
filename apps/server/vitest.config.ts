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
          },
        },
      };
    }),
  ],
});
