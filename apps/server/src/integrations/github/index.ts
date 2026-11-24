import {
  DEFAULT_DURATION,
  MEW_CARD_MAX,
  TASK_LIMITS,
  canUseIntegration,
  isRecord,
  type MewCard,
  type MewCardItem,
} from "@dailify/shared";
import { importTask, listOldestSyncs } from "../../db/calendar-sync";
import {
  claimPoll,
  deleteLink,
  listProviderLinks,
  markRevoked,
  saveEtag,
} from "../../db/integrations";
import { appendCompletion } from "../../db/tasks";
import { planOf } from "../../db/user";
import type { Env } from "../../index";
import { newTaskId } from "../../lib/task-input";
import { loadCtx } from "../connection";
import type { Ctx, Provider } from "../types";

const API = "https://api.github.com";
const P = "github";
// GitHub requires a User-Agent on every API call.
const HEADERS = {
  accept: "application/vnd.github+json",
  "x-github-api-version": "2022-11-28",
  "user-agent": "Mewki",
};
// `/issues` sends no X-Poll-Interval; this is the floor between two polls of one connection.
const THROTTLE = 5 * 60_000;
const PAGE = 100;
const REF = /^([\w.-]+\/[\w.-]+)#(\d+)$/;
const HTML = /github\.com\/([\w.-]+\/[\w.-]+)\/(?:issues|pull)\/(\d+)/;

/** What the Mew reads back instead of an error: she tells the user in her own words. */
class Notice extends Error {}

const records = (v: unknown) => (Array.isArray(v) ? v.filter(isRecord) : []);
const str = (v: unknown) => (typeof v === "string" ? v : "");

async function call(ctx: Ctx, path: string, headers: Record<string, string> = {}) {
  const res = await ctx.api(`${API}${path}`, { headers: { ...HEADERS, ...headers } });
  if (res.status === 401) {
    await markRevoked(ctx.env.DB, ctx.userId, P, Date.now());
    throw new Error("GitHub token revoked");
  }
  return res;
}

async function json(ctx: Ctx, path: string): Promise<unknown> {
  const res = await call(ctx, path);
  if (res.status === 404) throw new Notice(`Nothing on GitHub at ${path} that this account sees.`);
  if (res.status === 403 || res.status === 429)
    throw new Notice("GitHub is rate limiting this account; try again in a few minutes.");
  if (!res.ok) throw new Error(`GitHub ${path}: ${res.status}`);
  return res.json();
}

/** An issue or PR from `/issues` or search: `owner/repo#123` and what the import reads. */
function readItem(raw: Record<string, unknown>) {
  const repo = str(raw.repository_url).replace(`${API}/repos/`, "");
  const url = str(raw.html_url);
  if (!repo || typeof raw.number !== "number" || !url.startsWith("https://")) return null;
  return {
    ref: `${repo}#${raw.number}`,
    title: (str(raw.title).trim() || "Sem título").slice(0, TASK_LIMITS.titleMax),
    url,
    pr: isRecord(raw.pull_request),
  };
}

const line = (raw: Record<string, unknown>) => {
  const it = readItem(raw);
  return it && `- ${it.ref}${it.pr ? " (PR)" : ""}: ${it.title}`;
};

/** Gone from the assigned open list: closed = done at `closed_at`, else unassigned or no access. */
async function settle(ctx: Ctx, taskId: string, ref: string, now: number): Promise<void> {
  const m = REF.exec(ref);
  const res = m && (await call(ctx, `/repos/${m[1]}/issues/${m[2]}`));
  if (res && !res.ok && res.status !== 404 && res.status !== 410)
    throw new Error(`GitHub ${ref}: ${res.status}`);
  const raw: unknown = res?.ok ? await res.json() : null;
  if (isRecord(raw) && raw.state === "closed")
    await appendCompletion(ctx.env.DB, ctx.userId, taskId, Date.parse(str(raw.closed_at)) || now);
  // Unassigned, deleted or out of reach: the task stays a plain task.
  else await deleteLink(ctx.env.DB, ctx.userId, P, taskId);
}

/**
 * Open issues and PRs assigned to the user become undated tasks; one that leaves the list is
 * completed (closed) or unlinked (unassigned). One-way, zero AI. `minGap` 0 = the import on connect.
 */
export async function syncGithub(
  env: Env,
  userId: string,
  minGap = THROTTLE,
): Promise<{ imported: number }> {
  const now = Date.now();
  const claim = await claimPoll(env.DB, userId, P, now, minGap);
  if (!claim) return { imported: 0 };
  const ctx = await loadCtx(env, userId, P);
  if (!ctx) return { imported: 0 };
  // A 304 costs no rate limit and means nothing changed.
  const res = await call(
    ctx,
    `/issues?filter=assigned&state=open&per_page=${PAGE}`,
    claim.etag ? { "if-none-match": claim.etag } : {},
  );
  if (res.status === 304) return { imported: 0 };
  if (!res.ok) throw new Error(`GitHub /issues: ${res.status}`);
  const raw = records(await res.json());
  const items = raw.map(readItem).filter((i) => i !== null);
  const links = await listProviderLinks(env.DB, userId, P);
  const known = new Set(links.map((l) => l.externalId));

  let imported = 0;
  for (const it of items) {
    if (known.has(it.ref)) continue;
    const id = newTaskId();
    await importTask(
      env.DB,
      userId,
      {
        id,
        title: it.title,
        date: now,
        duration: DEFAULT_DURATION,
        priority: 0,
        repeat: "Off",
        undated: true,
        links: [it.url],
        completed: [],
        updatedAt: now,
      },
      {
        provider: P,
        taskId: id,
        externalId: it.ref,
        url: it.url,
        timeZone: "UTC",
        imported: true,
        readonly: false,
        remoteUpdated: now,
      },
      now,
    );
    imported++;
  }
  // ponytail: one page of 100; a full page may hide the rest, so nothing is settled then. Follow
  // the `Link: rel="next"` pages when someone has more than 100 open assigned issues.
  if (raw.length < PAGE) {
    const open = new Set(items.map((i) => i.ref));
    for (const l of links)
      if (!l.done && !open.has(l.externalId)) await settle(ctx, l.taskId, l.externalId, now);
  }
  await saveEtag(env.DB, userId, P, res.headers.get("etag"));
  return { imported };
}

/** The `GET /tasks` `waitUntil` and the cron: plan-gated, failures only logged. */
export async function pollGithub(env: Env, userId: string): Promise<void> {
  try {
    if (canUseIntegration(await planOf(env.DB, userId), P)) await syncGithub(env, userId);
  } catch (err) {
    console.error(`GitHub sync failed for ${userId}`, err);
  }
}

export async function pollOldestGithub(env: Env): Promise<void> {
  for (const userId of await listOldestSyncs(env.DB, 25, P)) await pollGithub(env, userId);
}

/** A card row for an issue or PR; `linked` = already a Mewki task. */
function cardItem(raw: Record<string, unknown>, linked: Set<string>, review = false) {
  const it = readItem(raw);
  if (!it) return null;
  const labels = records(raw.labels)
    .map((l) => str(l.name))
    .filter(Boolean)
    .slice(0, 3);
  const at = Date.parse(str(raw.updated_at));
  return {
    ref: it.ref,
    item: {
      title: it.title,
      url: it.url,
      icon: it.pr ? "pr" : "issue",
      where: it.ref.replace("#", " #"),
      ...(Number.isFinite(at) && { at }),
      ...(labels.length > 0 && { labels }),
      ...(review && { review }),
      linked: linked.has(it.ref),
    } satisfies MewCardItem,
  };
}

const linkedRefs = async (ctx: Ctx) =>
  new Set((await listProviderLinks(ctx.env.DB, ctx.userId, P)).map((l) => l.externalId));

/** Target `*`: open issues/PRs assigned to the user and PRs waiting for their review. */
async function overview(ctx: Ctx): Promise<{ text: string; card: MewCard }> {
  // Import first, so every assigned row of the card shows as already on the agenda.
  try {
    await syncGithub(ctx.env, ctx.userId, 0);
  } catch (err) {
    console.error(`GitHub sync before a read failed for ${ctx.userId}`, err);
  }
  const q = encodeURIComponent("is:open is:pr review-requested:@me");
  const [assigned, reviews, linked] = await Promise.all([
    json(ctx, "/issues?filter=assigned&state=open&per_page=30"),
    json(ctx, `/search/issues?q=${q}&per_page=30`),
    linkedRefs(ctx),
  ]);
  const reviewList = records(isRecord(reviews) ? reviews.items : []);
  const list = (v: Record<string, unknown>[]) =>
    v
      .map(line)
      .filter((l) => l !== null)
      .join("\n") || "(none)";
  const seen = new Set<string>();
  const items = [
    ...records(assigned).map((r) => cardItem(r, linked)),
    ...reviewList.map((r) => cardItem(r, linked, true)),
  ].flatMap((c) => (c && !seen.has(c.ref) && seen.add(c.ref) ? [c.item] : []));
  return {
    text: [
      `Assigned to the user, open:\n${list(records(assigned))}`,
      `Pull requests waiting for the user's review:\n${list(reviewList)}`,
    ].join("\n\n"),
    card: {
      provider: P,
      source: "GitHub",
      url: "https://github.com/issues/assigned",
      total: items.length,
      items: items.slice(0, MEW_CARD_MAX),
    },
  };
}

/** Target `owner/repo#123` (or its URL): the item, its body trimmed and its last comments. */
async function issue(ctx: Ctx, repo: string, n: string): Promise<{ text: string; card?: MewCard }> {
  const raw = await json(ctx, `/repos/${repo}/issues/${n}`);
  if (!isRecord(raw)) throw new Error("GitHub issue: unexpected body");
  const count = typeof raw.comments === "number" ? raw.comments : 0;
  // Comments come oldest first: the last page of 10 holds the newest.
  const comments = count
    ? records(
        await json(
          ctx,
          `/repos/${repo}/issues/${n}/comments?per_page=10&page=${Math.ceil(count / 10)}`,
        ),
      )
    : [];
  const login = (v: unknown) => str(isRecord(v) ? v.login : undefined) || "ghost";
  const who = (v: unknown) => `@${login(v)}`;
  const text = [
    `${repo}#${n}${isRecord(raw.pull_request) ? " (PR)" : ""} [${str(raw.state)}]: ${str(raw.title)}`,
    `${str(raw.html_url)} · opened by ${who(raw.user)} · ${count} comments`,
    str(raw.body).slice(0, 2000) || "(no description)",
    ...comments.map(
      (c) => `${who(c.user)} (${str(c.created_at).slice(0, 10)}): ${str(c.body).slice(0, 500)}`,
    ),
  ].join("\n\n");
  const row = cardItem(raw, await linkedRefs(ctx));
  if (!row) return { text };
  return {
    text,
    card: {
      provider: P,
      source: row.item.where,
      url: row.item.url,
      total: 1,
      items: [row.item],
      detail: {
        state: raw.state === "closed" ? "closed" : "open",
        author: login(raw.user),
        comments: count,
        body: str(raw.body).trim().slice(0, 400),
        recent: comments.slice(-2).map((c) => ({
          author: login(c.user),
          at: Date.parse(str(c.created_at)) || 0,
          text: str(c.body).trim().slice(0, 280),
        })),
      },
    },
  };
}

export const github: Provider = {
  id: P,
  oauth: {
    authorizeUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    // The base of `revoke` below: `DELETE /applications/{client_id}/grant`.
    revokeUrl: `${API}/applications`,
    credentials: (env) => ({ id: env.GITHUB_CLIENT_ID, secret: env.GITHUB_CLIENT_SECRET }),
    // OAuth apps have no read-only scope for private repos: `repo` is the only way to see them.
    scopes: ["repo", "read:user"],
    required: ["repo"],
    async revoke(env, tokens) {
      const { id, secret } = github.oauth.credentials(env);
      const res = await fetch(`${API}/applications/${id}/grant`, {
        method: "DELETE",
        headers: {
          ...HEADERS,
          authorization: `Basic ${btoa(`${id}:${secret}`)}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ access_token: tokens.accessToken }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`GitHub revoke ${res.status}`);
    },
  },
  async identify(ctx) {
    const body = await json(ctx, "/user");
    const id = isRecord(body) ? body.id : undefined;
    if (typeof id !== "number") throw new Error("GitHub /user without id");
    // The card shows the login where Google shows an e-mail.
    return { accountId: String(id), email: isRecord(body) ? str(body.login) || null : null };
  },
  sync: (env, userId) => syncGithub(env, userId, 0),
  target: `"*" (issues e PRs abertos atribuídos à pessoa e os PRs esperando a review dela: leia este antes de adivinhar) ou "dono/repo#123" (título, estado, descrição e os últimos comentários)`,
  async read(env, userId, target) {
    const ctx = await loadCtx(env, userId, P);
    if (!ctx) throw new Error("github is not connected");
    try {
      const t = target.trim();
      if (t === "*") return await overview(ctx);
      const m = REF.exec(t) ?? HTML.exec(t);
      if (!m) return { text: `"${t}" is not owner/repo#123 nor a GitHub issue or PR link.` };
      return await issue(ctx, m[1], m[2]);
    } catch (err) {
      if (err instanceof Notice) return { text: err.message };
      throw err;
    }
  },
};
