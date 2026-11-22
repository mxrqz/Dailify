-- Passkeys (bd Dailify-i39k.4): the `@better-auth/passkey` plugin's table, CLI output
-- (`scripts/auth-schema.ts`) diffed against 0021. New table only; `passkey` cascades with the user,
-- so account deletion needs no `deleteUserData` entry.
create table "passkey" ("id" text not null primary key, "name" text, "publicKey" text not null, "userId" text not null references "user" ("id") on delete cascade, "credentialID" text not null, "counter" integer not null, "deviceType" text not null, "backedUp" integer not null, "transports" text, "createdAt" date, "aaguid" text);

create index "passkey_userId_idx" on "passkey" ("userId");

create index "passkey_credentialID_idx" on "passkey" ("credentialID");
