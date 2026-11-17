import type { Role } from "@dailify/shared";

type Who = { id: string; plan?: Role } | null;

/**
 * Sessão falsa para teste de rota: o `requireAuth` de verdade roda, só o `getSession` sai daqui.
 *   vi.mock("../src/auth", () => import("./session"));
 *   mockSession(() => ({ id: userId, plan: role })); // lido a cada request; `null` = 401
 */
let who: () => Who = () => null;

export const mockSession = (get: () => Who) => {
  who = get;
};

/** Linha na tabela `"user"` do Better Auth, com os campos que o servidor lê. */
export async function seedUser(
  db: D1Database,
  id: string,
  extra: { plan?: string; stripeCustomerId?: string } = {},
): Promise<void> {
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT OR REPLACE INTO "user" (id, name, email, emailVerified, createdAt, updatedAt, plan,
       stripeCustomerId) VALUES (?, '', ?, 1, ?, ?, ?, ?)`,
    )
    .bind(id, `${id}@test.local`, now, now, extra.plan ?? null, extra.stripeCustomerId ?? null)
    .run();
}

export const auth = {
  api: {
    getSession: async () => {
      const user = who();
      return user && { user: { plan: "free", ...user }, session: { userId: user.id } };
    },
  },
  handler: () => new Response(null, { status: 404 }),
};
