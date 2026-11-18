import type { Role } from "@dailify/shared";

// O usuário mora na tabela `"user"` do Better Auth (migração 0015); `plan` e `stripeCustomerId` são
// `additionalFields` com `input: false` — só o servidor escreve, nunca o corpo de um request.

/** Quem nunca assinou não tem `plan` gravado. */
export const roleOf = (plan: unknown): Role =>
  plan === "pro" || plan === "max" || plan === "admin" ? plan : "free";

/** The plan as D1 has it now; an absent row or plan is `free`. */
export async function planOf(db: D1Database, userId: string): Promise<Role> {
  const row = await db
    .prepare(`SELECT plan FROM "user" WHERE id=?`)
    .bind(userId)
    .first<{ plan: string | null }>();
  return roleOf(row?.plan);
}

export async function billingProfile(
  db: D1Database,
  userId: string,
): Promise<{ email: string | undefined; stripeCustomerId: string | undefined }> {
  const row = await db
    .prepare(`SELECT email, stripeCustomerId FROM "user" WHERE id=?`)
    .bind(userId)
    .first<{ email: string; stripeCustomerId: string | null }>();
  return { email: row?.email, stripeCustomerId: row?.stripeCustomerId ?? undefined };
}

/**
 * Usuário apagado vira UPDATE de zero linhas, não erro: um throw aqui seria 500 no webhook do
 * Stripe, que retenta e acaba desabilitando o endpoint para todo mundo. Customer ausente mantém o
 * gravado.
 */
export async function updateUserRole(
  db: D1Database,
  params: { userId: string; role: Role; stripeCustomerId: string | undefined },
): Promise<void> {
  await db
    .prepare(
      `UPDATE "user" SET plan=?, stripeCustomerId=COALESCE(?, stripeCustomerId), updatedAt=?
       WHERE id=?`,
    )
    .bind(params.role, params.stripeCustomerId ?? null, new Date().toISOString(), params.userId)
    .run();
}

/** Every app table keyed by `user_id`; `account-delete.test.ts` fails when the schema adds one. */
export const USER_TABLES = [
  "tasks",
  "push_subscriptions",
  "user_settings",
  "usage",
  "integration_connections",
  "integration_links",
  "oauth_states",
  "mew_actions",
] as const;

/** Tudo que o usuário tem no D1 — chamado pelo `afterDelete` da conta (auth-options.ts). */
export async function deleteUserData(db: D1Database, userId: string): Promise<void> {
  await db.batch(
    USER_TABLES.map((t) => db.prepare(`DELETE FROM ${t} WHERE user_id=?`).bind(userId)),
  );
}

/**
 * Um e-mail por endereço por `cooldownMs`, contado só nos que saíram (o plugin cria o token antes
 * de chamar a gente). Reserva atômica: quem perde a corrida não manda; a resposta não muda.
 */
export async function claimMagicLinkSend(
  db: D1Database,
  email: string,
  now: number,
  cooldownMs: number,
): Promise<boolean> {
  const row = await db
    .prepare(
      `INSERT INTO magic_link_sent (email, sent_at) VALUES (?, ?)
       ON CONFLICT(email) DO UPDATE SET sent_at=excluded.sent_at WHERE sent_at<=?
       RETURNING 1 AS ok`,
    )
    .bind(email, now, now - cooldownMs)
    .first();
  return row !== null;
}

/** Envio que falhou devolve a vaga: senão a pessoa espera um minuto por um e-mail que não saiu. */
export async function releaseMagicLinkSend(
  db: D1Database,
  email: string,
  sentAt: number,
): Promise<void> {
  await db
    .prepare(`DELETE FROM magic_link_sent WHERE email=? AND sent_at=?`)
    .bind(email, sentAt)
    .run();
}

/** The app's PKCE challenge for a link, sweeping the expired ones in the same batch. */
export async function saveMagicLinkChallenge(
  db: D1Database,
  tokenHash: string,
  challenge: string,
  now: number,
  expiresAt: number,
): Promise<void> {
  await db.batch([
    db.prepare(`DELETE FROM magic_link_challenge WHERE expires_at<?`).bind(now),
    db
      .prepare(
        `INSERT INTO magic_link_challenge (token_hash, challenge, expires_at) VALUES (?, ?, ?)`,
      )
      .bind(tokenHash, challenge, expiresAt),
  ]);
}

export async function getMagicLinkChallenge(
  db: D1Database,
  tokenHash: string,
): Promise<string | null> {
  const row = await db
    .prepare(`SELECT challenge FROM magic_link_challenge WHERE token_hash=?`)
    .bind(tokenHash)
    .first<{ challenge: string }>();
  return row?.challenge ?? null;
}

/** Some só depois que o token foi consumido: se o verify falhou antes, o challenge continua valendo. */
export async function dropUsedMagicLinkChallenge(db: D1Database, tokenHash: string): Promise<void> {
  await db
    .prepare(
      `DELETE FROM magic_link_challenge WHERE token_hash=?
       AND NOT EXISTS (SELECT 1 FROM verification WHERE identifier='magic-link:' || ?)`,
    )
    .bind(tokenHash, tokenHash)
    .run();
}

/**
 * Conta apagada não deixa o e-mail para trás: links pendentes (e seus challenges), a vaga do
 * limite e, de carona, os `verification` vencidos de todo mundo.
 */
export async function forgetEmail(db: D1Database, email: string): Promise<void> {
  const mine = `identifier LIKE 'magic-link:%' AND CASE WHEN json_valid(value)
    THEN lower(json_extract(value, '$.email')) END = ?`;
  const lower = email.toLowerCase();
  await db.batch([
    db
      .prepare(
        `DELETE FROM magic_link_challenge WHERE token_hash IN
         (SELECT substr(identifier, 12) FROM verification WHERE ${mine})`,
      )
      .bind(lower),
    db
      .prepare(`DELETE FROM verification WHERE ${mine} OR expiresAt<?`)
      .bind(lower, new Date().toISOString()),
    db.prepare(`DELETE FROM magic_link_sent WHERE email=?`).bind(lower),
  ]);
}
