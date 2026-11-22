// Local dev data: `bun run seed` (here or at the root) applies the local migrations, then upserts
// the seed account and replaces its `seed-*` tasks in the same D1 `wrangler dev` uses; sessions,
// integrations and other tasks survive. Sign in with SEED_EMAIL and SEED_PASSWORD. Dates are
// relative to today, so the agenda always has something to show.
import { TZDate } from "@date-fns/tz";
import { hashPassword } from "better-auth/crypto";
import type { Repeat, Task } from "@dailify/shared";
import { getPlatformProxy } from "wrangler";

import { insertStatement } from "../src/db/tasks";

const SEED_EMAIL = "dev@mewki.local";
const SEED_PASSWORD = "mewki-dev-local";
const USER_ID = "seed-dev-user";
const ZONE = "America/Sao_Paulo";

const { env, dispose } = await getPlatformProxy<{ DB: D1Database }>();
const db = env.DB;
const now = Date.now();
const today = new TZDate(now, ZONE);

/** `days` from today at `hh:mm` in the seed zone. */
const at = (days: number, hh = 9, mm = 0): number =>
  +new TZDate(today.getFullYear(), today.getMonth(), today.getDate() + days, hh, mm, ZONE);

let n = 0;
const task = (title: string, date: number, over: Partial<Task> = {}): Task => ({
  id: `seed-${++n}`,
  title,
  date,
  duration: "30m",
  priority: 0,
  repeat: "Off" satisfies Repeat,
  completed: [],
  updatedAt: now,
  ...over,
});

const tasks: Task[] = [
  // Today: past, now-ish and later, one done.
  task("Revisar PRs", at(0, 8), { completed: [at(0, 8, 40)], duration: "45m" }),
  task("Reunião de planejamento", at(0, 10), { duration: "1h", priority: 3, alert: at(0, 9, 50) }),
  task("Almoço com a Bia", at(0, 12, 30), { duration: "1h30m", tags: ["pessoal"] }),
  task("Responder e-mails", at(0, 15), { links: ["https://mail.google.com"] }),
  task("Academia", at(0, 19), { duration: "1h", tags: ["saude"] }),
  // Overdue and past.
  task("Enviar relatório mensal", at(-1, 17), { priority: 4 }),
  task("Pagar conta de luz", at(-2, 10), { completed: [at(-2, 11)] }),
  // Coming days.
  task("Dentista", at(1, 14), { duration: "1h", alert: at(1, 13) }),
  task("Entregar proposta", at(2, 18), { priority: 2 }),
  task("Aniversário da mãe", at(4, 0), { duration: "", tags: ["familia"] }),
  task("Viagem pra Floripa", at(6, 20), { duration: "40h" }),
  task("Call com cliente", at(9, 11), { duration: "45m", links: ["https://meet.google.com"] }),
  // Series.
  task("Meditar", at(-10, 7), { repeat: "Daily", duration: "10m", completed: [at(-1, 7, 10)] }),
  task("Treino de força", at(-14, 7, 30), {
    repeat: { Weekly: ["Monday", "Wednesday", "Friday"] },
    duration: "1h",
  }),
  task("Pagar aluguel", at(-40, 9), { repeat: "Monthly" }),
  task("Inglês", at(-7, 20), { repeat: "Daily", repeatEvery: 2, duration: "1h" }),
  // Undated, one a daily series.
  task("Comprar lâmpada", now, { undated: true }),
  task("Ligar pro encanador", now, { undated: true, priority: 2 }),
  task("Ler 20 páginas", now, { undated: true, repeat: "Daily" }),
  // Older than the 6-month sync window: only comes from the server.
  task("Renovar passaporte", at(-240, 10), { completed: [at(-240, 12)] }),
];

const iso = new Date(now).toISOString();
// Upserts, never DELETE + INSERT: deleting the user cascades to its sessions and integrations.
await db.batch([
  db
    .prepare(
      `INSERT INTO "user" (id,name,email,emailVerified,createdAt,updatedAt,plan,twoFactorEnabled)
       VALUES (?,?,?,1,?,?,'max',0)
       ON CONFLICT(id) DO UPDATE SET emailVerified=1, plan='max', updatedAt=excluded.updatedAt`,
    )
    .bind(USER_ID, "Dev", SEED_EMAIL, iso, iso),
  db
    .prepare(
      `INSERT INTO account (id,accountId,providerId,userId,password,createdAt,updatedAt)
       VALUES (?,?,'credential',?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET password=excluded.password, updatedAt=excluded.updatedAt`,
    )
    .bind(`${USER_ID}-credential`, USER_ID, USER_ID, await hashPassword(SEED_PASSWORD), iso, iso),
  db
    .prepare(
      `INSERT INTO user_settings (user_id,week_start,time_zone,hour12,mew_consent_at) VALUES (?,1,?,0,?)
       ON CONFLICT(user_id) DO UPDATE SET time_zone=excluded.time_zone,
         mew_consent_at=COALESCE(user_settings.mew_consent_at, excluded.mew_consent_at)`,
    )
    .bind(USER_ID, ZONE, now),
  db.prepare(`DELETE FROM tasks WHERE user_id=? AND id LIKE 'seed-%'`).bind(USER_ID),
  ...tasks.map((t) => insertStatement(db, USER_ID, t)),
]);
await dispose();

console.log(`Seeded ${tasks.length} tasks. Sign in with ${SEED_EMAIL} / ${SEED_PASSWORD}`);
