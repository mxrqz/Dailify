import assert from "node:assert";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
// One-off: Clerk users -> Better Auth rows in D1, as reviewable SQL. No deps, no writes.
//   CLERK_SECRET_KEY=sk_live_... bun apps/server/scripts/clerk-to-d1.ts > clerk-import.sql
//   (review) && wrangler d1 execute dailify --remote --file clerk-import.sql
// Targets the schema in migrations/0015_better_auth.sql (camelCase columns, `plan` +
// `stripeCustomerId` additionalFields). BA's sqlite adapter stores dates as ISO strings and
// booleans as 0/1, so that is what we emit. Clerk `user_…` ids are kept: every D1 table and the
// Stripe `clerkUserId` metadata keep pointing at the same person.
// `bun scripts/clerk-to-d1.ts --check` asserts the output AND applies it on top of every migration
// in an in-memory sqlite, so a column rename in 0015 breaks the check, not the prod import.

type ClerkEmail = { id: string; email_address: string; verification: { status: string } | null };
type ClerkExternal = {
  id: string;
  provider: string; // "oauth_google"
  provider_user_id: string; // Google `sub` -> account.accountId
  approved_scopes: string;
  created_at: number;
  updated_at: number;
};
export type ClerkUser = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  image_url: string;
  has_image: boolean;
  primary_email_address_id: string | null;
  email_addresses: ClerkEmail[];
  external_accounts: ClerkExternal[];
  private_metadata: Record<string, unknown>;
  unsafe_metadata: Record<string, unknown>;
  created_at: number;
  updated_at: number;
};

const q = (v: string | number | null | undefined): string =>
  v === null || v === undefined
    ? "NULL"
    : typeof v === "number"
      ? String(v)
      : `'${v.replaceAll("'", "''")}'`;
const iso = (ms: number) => q(new Date(ms).toISOString());
const PLANS = ["pro", "max", "admin"];

export function toSql(users: ClerkUser[]): string {
  const out: string[] = [
    "-- Apply BEFORE deploying the Better Auth server: a sign-in after that deploy creates a fresh",
    '-- "user" row for the same email and this import then fails on UNIQUE(email). On that error,',
    "-- do not skip the row (its tasks would be orphaned): merge the duplicate by hand first.",
  ];
  for (const u of users) {
    const primary = u.email_addresses.find((e) => e.id === u.primary_email_address_id);
    if (!primary) {
      out.push(`-- SKIP ${u.id}: no primary email`);
      continue;
    }
    const plan =
      typeof u.private_metadata.plan === "string" && PLANS.includes(u.private_metadata.plan)
        ? u.private_metadata.plan
        : "free";
    const cus =
      typeof u.private_metadata.stripeCustomerId === "string"
        ? u.private_metadata.stripeCustomerId
        : null;
    const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
    // ponytail: img.clerk.com URLs die with the Clerk instance; Google users refresh via overrideUserInfoOnSignIn.
    const image = u.has_image ? u.image_url : null;
    out.push(
      `INSERT INTO "user" ("id","name","email","emailVerified","image","createdAt","updatedAt","plan","stripeCustomerId") VALUES (` +
        [
          q(u.id),
          q(name),
          q(primary.email_address.toLowerCase()),
          primary.verification?.status === "verified" ? 1 : 0,
          q(image),
          iso(u.created_at),
          iso(u.updated_at),
          q(plan),
          q(cus),
        ].join(",") +
        `);`,
    );
    for (const a of u.external_accounts) {
      out.push(
        `INSERT INTO "account" ("id","accountId","providerId","userId","scope","createdAt","updatedAt") VALUES (` +
          [
            q(a.id),
            q(a.provider_user_id),
            q(a.provider.replace(/^oauth_/, "")),
            q(u.id),
            q(a.approved_scopes.replaceAll(" ", ",")),
            iso(a.created_at),
            iso(a.updated_at),
          ].join(",") +
          `);`,
      );
    }
    const tz = u.unsafe_metadata.timezone;
    if (typeof tz === "string") {
      out.push(
        `INSERT INTO user_settings (user_id, time_zone) VALUES (${q(u.id)}, ${q(tz)}) ON CONFLICT(user_id) DO UPDATE SET time_zone = COALESCE(user_settings.time_zone, excluded.time_zone);`,
      );
    }
  }
  return out.join("\n");
}

async function fetchAll(key: string): Promise<ClerkUser[]> {
  const all: ClerkUser[] = [];
  for (let offset = 0; ; offset += 500) {
    const res = await fetch(
      `https://api.clerk.com/v1/users?limit=500&offset=${offset}&order_by=created_at`,
      {
        headers: { Authorization: `Bearer ${key}` },
      },
    );
    if (!res.ok) throw new Error(`Clerk ${res.status}: ${await res.text()}`);
    const page: ClerkUser[] = await res.json();
    all.push(...page);
    if (page.length < 500) return all;
  }
}

if (import.meta.main) {
  if (process.argv[2] === "--check") {
    const sql = toSql([
      {
        id: "user_a",
        first_name: "Ana",
        last_name: "O'Neil",
        image_url: "x",
        has_image: false,
        primary_email_address_id: "e1",
        email_addresses: [
          { id: "e1", email_address: "Ana@X.com", verification: { status: "verified" } },
        ],
        external_accounts: [
          {
            id: "eac_1",
            provider: "oauth_google",
            provider_user_id: "1234",
            approved_scopes: "email profile",
            created_at: 1e12,
            updated_at: 1e12,
          },
        ],
        private_metadata: { plan: "pro", stripeCustomerId: "cus_1" },
        unsafe_metadata: { timezone: "America/Sao_Paulo" },
        created_at: 1e12,
        updated_at: 1e12,
      },
      {
        id: "user_b",
        first_name: null,
        last_name: null,
        image_url: "",
        has_image: false,
        primary_email_address_id: null,
        email_addresses: [],
        external_accounts: [],
        private_metadata: {},
        unsafe_metadata: {},
        created_at: 1e12,
        updated_at: 1e12,
      },
    ]);
    assert.ok(sql.includes(`'user_a','Ana O''Neil','ana@x.com',1,NULL,`), "user row");
    assert.ok(sql.includes(`'pro','cus_1'`), "plan + customer");
    assert.ok(sql.includes(`'eac_1','1234','google','user_a','email,profile'`), "google account");
    assert.ok(sql.includes("America/Sao_Paulo"), "timezone");
    assert.ok(sql.includes("-- SKIP user_b"), "skip no-email");
    assert.ok(sql.startsWith("-- Apply BEFORE deploying"), "rollout warning");
    const { Database } = await import("bun:sqlite");
    const db = new Database(":memory:");
    const dir = path.join(import.meta.dir, "../migrations");
    for (const f of readdirSync(dir).sort()) db.exec(readFileSync(path.join(dir, f), "utf8"));
    db.exec(sql);
    assert.deepEqual(db.query(`SELECT plan, stripeCustomerId FROM "user"`).all(), [
      { plan: "pro", stripeCustomerId: "cus_1" },
    ]);
    console.log(sql);
  } else {
    const key = process.env.CLERK_SECRET_KEY;
    if (!key) throw new Error("CLERK_SECRET_KEY missing");
    const users = await fetchAll(key);
    console.error(`${users.length} users`);
    console.log(toSql(users));
  }
}
