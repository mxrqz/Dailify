import { beforeAll } from "vitest";

// setupFiles: each file gets its own D1. Idempotent, so a leftover beforeAll is harmless. Imported
// in the hook: a static `cloudflare:test` import here loads `src/` before the file's vi.mock runs.
beforeAll(async () => {
  const { applyD1Migrations, env } = await import("cloudflare:test");
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});
