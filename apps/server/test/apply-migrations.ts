import { beforeAll } from "vitest";
import { env } from "cloudflare:workers";

// setupFiles: each file gets its own D1. Not `applyD1Migrations` from `cloudflare:test`: importing
// that module loads `src/` (before the file's vi.mock runs if static, ~8 s per file inside the hook
// if dynamic, which times out under the full run). Same `d1_migrations` table, so a leftover
// beforeAll(applyD1Migrations) skips what this already applied.
beforeAll(async () => {
  await env.DB.prepare(
    "CREATE TABLE IF NOT EXISTS d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)",
  ).run();
  const { results } = await env.DB.prepare("SELECT name FROM d1_migrations").all<{
    name: string;
  }>();
  const applied = new Set(results.map((row) => row.name));
  for (const migration of env.TEST_MIGRATIONS) {
    if (applied.has(migration.name)) continue;
    await env.DB.batch([
      ...migration.queries.map((query) => env.DB.prepare(query)),
      env.DB.prepare("INSERT INTO d1_migrations (name) VALUES (?)").bind(migration.name),
    ]);
  }
});
