import { env } from "cloudflare:workers";
import type { Role } from "@dailify/shared";

type Who = { id: string; plan?: Role } | null;

/**
 * Sessão falsa para teste de rota: o `requireAuth` de verdade roda, só o `getSession` sai daqui.
 *   vi.mock("../src/auth", () => import("./session"));
 *   mockSession(() => ({ id: userId, plan: role })); // lido a cada request; `null` = 401
 * O `requireAuth` lê o `plan` do D1: com `plan`, a linha do usuário é gravada antes (como o webhook).
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

/** Fake MCP access token: `Authorization: Bearer mcp:<userId>` is that user, anything else null. */
export const mcpUserId = async (req: Request) =>
  /^Bearer mcp:(.+)$/.exec(req.headers.get("authorization") ?? "")?.[1] ?? null;

export const auth = {
  api: {
    getSession: async () => {
      const user = who();
      if (user?.plan) await seedUser(env.DB, user.id, { plan: user.plan });
      return (
        user && { user: { id: user.id }, session: { id: `session-${user.id}`, userId: user.id } }
      );
    },
  },
  handler: () => new Response(null, { status: 404 }),
};
