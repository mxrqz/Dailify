-- MFA (bd Dailify-i39k.3): the Better Auth `twoFactor` plugin's table and user flag, CLI output
-- (`scripts/auth-schema.ts`) diffed against 0015. A NULL `twoFactorEnabled` reads as off, so every
-- existing user keeps signing in with one factor. `twoFactor` cascades with the user.
alter table "user" add column "twoFactorEnabled" integer;

create table "twoFactor" ("id" text not null primary key, "secret" text not null, "backupCodes" text not null, "userId" text not null references "user" ("id") on delete cascade, "verified" integer, "failedVerificationCount" integer, "lockedUntil" date);

create index "twoFactor_secret_idx" on "twoFactor" ("secret");

create index "twoFactor_userId_idx" on "twoFactor" ("userId");

-- App table: when a session last passed a second factor (sign-in or step-up), epoch-ms. Keyed by
-- session and cascading with it, so account deletion needs no `deleteUserData` entry.
CREATE TABLE session_mfa (
  session_id TEXT PRIMARY KEY REFERENCES session (id) ON DELETE CASCADE,
  verified_at INTEGER NOT NULL
);
