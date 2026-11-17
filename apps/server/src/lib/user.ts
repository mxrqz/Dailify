import type { Role } from "@dailify/shared";

// O usuário mora na tabela `"user"` do Better Auth (migração 0015); `plan` e `stripeCustomerId` são
// `additionalFields` com `input: false` — só o servidor escreve, nunca o corpo de um request.

/** Quem nunca assinou não tem `plan` gravado. */
export const roleOf = (plan: unknown): Role =>
  plan === "pro" || plan === "max" || plan === "admin" ? plan : "free";

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
