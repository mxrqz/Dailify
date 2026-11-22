import type { Task } from "@dailify/shared";
import type { Env } from "../index";
import { deleteLink, listTaskLinks, setLinkState, type StoredLink } from "../db/integrations";
import { getTask, updateTask } from "../db/tasks";
import { loadCtx } from "./connection";
import { withoutLink } from "./links";
import { InvalidGrantError } from "./oauth";
import { PROVIDERS } from "./registry";
import type { Ctx } from "./types";

/** Lido ANTES da escrita: os vínculos e a tarefa como estava. Sem vínculo = null, nada a propagar. */
export async function linkedTask(
  env: Env,
  userId: string,
  taskId: string,
): Promise<{ links: StoredLink[]; before: Task } | null> {
  const links = await listTaskLinks(env.DB, userId, taskId);
  if (!links.length) return null;
  const before = await getTask(env.DB, userId, taskId);
  return before && { links, before };
}

/** Um vínculo; lança se o provider falhar. "unlink" apaga o vínculo e tira o endereço da tarefa. */
export async function pushLink(
  env: Env,
  ctx: Ctx,
  link: StoredLink,
  before: Task | null,
  after: Task | null,
): Promise<void> {
  const provider = PROVIDERS[link.provider];
  if (!provider.onTaskChanged) return;
  const { DB } = env;
  if ((await provider.onTaskChanged(ctx, link, before, after)) === "unlink") {
    await deleteLink(DB, ctx.userId, link.provider, link.taskId);
    // Sem isso o web seguiria lendo a tarefa como "No Google Agenda" (é o `url` nos links).
    const links = withoutLink(after?.links, link.url);
    if (after && links) await updateTask(DB, ctx.userId, after.id, { links });
  } else if (link.stale) {
    const state = { stale: false, timeZone: link.timeZone ?? undefined };
    await setLinkState(DB, ctx.userId, link.provider, link.taskId, state, Date.now());
  }
}

/**
 * A edição da tarefa chegando nos providers vinculados, dentro do `waitUntil`: nunca falha nem
 * desfaz a escrita. Falhou (ou a conexão caiu) = vínculo `stale`, que o web oferece reenviar.
 */
export async function propagate(
  env: Env,
  userId: string,
  links: StoredLink[],
  before: Task | null,
  after: Task | null,
): Promise<void> {
  // A provider that takes no edits (GitHub's import) has nothing to push and never goes stale.
  const pushed = links.filter((l) => PROVIDERS[l.provider].onTaskChanged);
  await Promise.all(
    pushed.map(async (link) => {
      try {
        const ctx = await loadCtx(env, userId, link.provider);
        if (ctx) return await pushLink(env, ctx, link, before, after);
      } catch (err) {
        // invalid_grant: o `makeCtx` já marcou a conexão revogada.
        if (!(err instanceof InvalidGrantError))
          console.error(`Falha ao propagar ${link.taskId} pra ${link.provider}`, err);
      }
      await setLinkState(env.DB, userId, link.provider, link.taskId, { stale: true }, Date.now());
    }),
  );
}
