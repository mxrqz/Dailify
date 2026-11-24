import { MEW_CARD_MAX, isRecord, type MewCard } from "@dailify/shared";
import { markRevoked } from "../../db/integrations";
import { getSettings } from "../../db/settings";
import type { Env } from "../../index";
import { loadCtx } from "../connection";
import type { Ctx, Provider } from "../types";

const API = "https://slack.com/api";
// Unlisted apps get 1 history/replies call a minute and 15 messages (Slack, May 2025).
const LIMIT = "15";
const PERMALINK = /\/archives\/([A-Z0-9]+)\/p(\d{10})(\d{6})/;
const CHANNEL_ID = /^[CDG][A-Z0-9]{6,}$/;
const DEAD_TOKEN = new Set(["token_revoked", "invalid_auth", "account_inactive"]);

/** What the Mew reads back instead of an error: she tells the user in her own words. */
class Notice extends Error {}

type Person = { id: string; label: string; names: string[] };

async function call(
  ctx: Ctx,
  method: string,
  params: Record<string, string>,
  post = false,
): Promise<Record<string, unknown>> {
  const res = post
    ? await ctx.api(`${API}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify(params),
      })
    : await ctx.api(`${API}/${method}?${new URLSearchParams(params)}`);
  if (res.status === 429) {
    const wait = Number(res.headers.get("retry-after")) || 60;
    throw new Notice(`Slack is rate limiting this app; try again in ${wait} s.`);
  }
  const body: unknown = await res.json().catch(() => null);
  if (isRecord(body) && body.ok === true) return body;
  const error = isRecord(body) ? String(body.error) : `HTTP ${res.status}`;
  if (DEAD_TOKEN.has(error)) await markRevoked(ctx.env.DB, ctx.userId, "slack", Date.now());
  throw new Error(`Slack ${method}: ${error}`);
}

const records = (v: unknown) => (Array.isArray(v) ? v.filter(isRecord) : []);
const str = (v: unknown) => (typeof v === "string" ? v : "");

// ponytail: one page of 200 people and 200 conversations; page with `cursor` for bigger workspaces.
async function people(ctx: Ctx): Promise<Person[]> {
  const body = await call(ctx, "users.list", { limit: "200" });
  return records(body.members).map((m) => {
    const profile = isRecord(m.profile) ? m.profile : {};
    const names = [str(profile.display_name), str(m.real_name), str(m.name)].filter(Boolean);
    return { id: str(m.id), label: names[0] ?? str(m.id), names };
  });
}

/** "#geral", "@nome" (their DM), a raw id, or a message permalink (its thread). */
async function resolve(
  ctx: Ctx,
  target: string,
  team: () => Promise<Person[]>,
): Promise<{ channel: string; thread?: string; label?: string }> {
  const t = target.trim();
  const link = PERMALINK.exec(t);
  if (link) {
    const reply = URL.canParse(t) ? new URL(t).searchParams.get("thread_ts") : null;
    return { channel: link[1], thread: reply ?? `${link[2]}.${link[3]}` };
  }
  if (CHANNEL_ID.test(t)) return { channel: t };
  const list = await call(ctx, "conversations.list", {
    types: "public_channel,private_channel,mpim,im",
    exclude_archived: "true",
    limit: "200",
  });
  const conversations = records(list.channels);
  const name = t.replace(/^[#@]/, "").toLowerCase();
  let found: Record<string, unknown> | undefined;
  let label: string;
  if (t.startsWith("@")) {
    const person = (await team()).find((p) => p.names.some((n) => n.toLowerCase() === name));
    found = person && conversations.find((c) => c.is_im === true && c.user === person.id);
    label = `@${person?.label ?? name}`;
  } else {
    found = conversations.find((c) => str(c.name).toLowerCase() === name);
    label = `#${str(found?.name)}`;
  }
  const id = str(found?.id);
  if (!id) throw new Notice(`No Slack conversation matches "${t}" among the ones this user sees.`);
  return { channel: id, label };
}

/** Target `*`: the workspace, who the user is and the conversations they're in, by name. */
async function overview(ctx: Ctx): Promise<string> {
  const [me, list, team] = await Promise.all([
    call(ctx, "auth.test", {}),
    call(ctx, "conversations.list", {
      types: "public_channel,private_channel,mpim,im",
      exclude_archived: "true",
      limit: "200",
    }),
    people(ctx),
  ]);
  const names = new Map(team.map((p) => [p.id, p.label]));
  const conversations = records(list.channels);
  const channels = conversations
    .filter((c) => c.is_member === true && !c.is_im)
    .map((c) => `#${str(c.name)}${c.is_private === true ? " (privado)" : ""}`);
  const dms = conversations
    .filter((c) => c.is_im === true && !c.is_user_deleted)
    .map((c) => `@${names.get(str(c.user)) ?? str(c.user)}`);
  return [
    `Workspace: ${str(me.team)} (${str(me.url)}); a pessoa é @${names.get(str(me.user_id)) ?? str(me.user)}`,
    `Canais em que ela está: ${channels.join(", ") || "(nenhum)"}`,
    `DMs: ${dms.join(", ") || "(nenhuma)"}`,
  ].join("\n");
}

async function connected(env: Env, userId: string) {
  const ctx = await loadCtx(env, userId, "slack");
  if (!ctx) throw new Error("slack is not connected");
  return ctx;
}

export const slack: Provider = {
  id: "slack",
  oauth: {
    authorizeUrl: "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    revokeUrl: "https://slack.com/api/auth.revoke",
    credentials: (env) => ({ id: env.SLACK_CLIENT_ID, secret: env.SLACK_CLIENT_SECRET }),
    scopes: [
      "channels:read",
      "channels:history",
      "groups:read",
      "groups:history",
      "im:read",
      "im:history",
      "mpim:read",
      "mpim:history",
      "users:read",
      "chat:write",
    ],
    required: ["channels:history", "im:history", "chat:write"],
    userToken: true,
  },
  async identify(ctx) {
    const body = await call(ctx, "auth.test", {});
    // The card shows the workspace host where Google shows an e-mail.
    const url = str(body.url);
    return {
      accountId: `${str(body.team_id)}:${str(body.user_id)}`,
      email: URL.canParse(url) ? new URL(url).host : null,
    };
  },
  target: `"*" (o workspace, a conta e os canais e DMs da pessoa: leia este antes de adivinhar um canal), canal "#geral", pessoa "@nome" (a DM com ela) ou o link de uma mensagem (a thread dela)`,
  async read(env, userId, target) {
    const ctx = await connected(env, userId);
    try {
      if (target.trim() === "*") return { text: await overview(ctx) };
      let team: Promise<Person[]> | undefined;
      const members = () => (team ??= people(ctx));
      const to = await resolve(ctx, target, members);
      const body = to.thread
        ? await call(ctx, "conversations.replies", {
            channel: to.channel,
            ts: to.thread,
            limit: LIMIT,
          })
        : await call(ctx, "conversations.history", { channel: to.channel, limit: LIMIT });
      // A raw id or permalink names no conversation, so the card asks for it.
      const [list, { timeZone }, me, info] = await Promise.all([
        members(),
        getSettings(env.DB, userId),
        call(ctx, "auth.test", {}),
        to.label ? null : call(ctx, "conversations.info", { channel: to.channel }),
      ]);
      const names = new Map(list.map((p) => [p.id, p.label]));
      const mentions = (text: string) =>
        text.replace(/<@([A-Z0-9]+)>/g, (_, id: string) => `@${names.get(id) ?? id}`);
      // sv-SE formats as "2026-11-21 14:05".
      const clock = new Intl.DateTimeFormat("sv-SE", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: timeZone ?? "UTC",
      });
      // History is newest first, a thread oldest first (from its root).
      const messages = records(body.messages);
      if (!to.thread) messages.reverse();
      const who = (m: Record<string, unknown>) =>
        names.get(str(m.user)) ?? (str(m.username) || str(m.user) || "bot");
      const lines = messages.map(
        (m) => `${who(m)} (${clock.format(Number(m.ts) * 1000)}): ${mentions(str(m.text))}`,
      );
      const text = lines.join("\n") || "(no messages)";
      const base = str(me.url);
      if (!messages.length || !URL.canParse(base)) return { text };
      const conv = info && isRecord(info.channel) ? info.channel : {};
      const label =
        to.label ??
        (conv.is_im === true
          ? `@${names.get(str(conv.user)) ?? str(conv.user)}`
          : `#${str(conv.name)}`);
      const room = new URL(`archives/${to.channel}`, base).href;
      const card: MewCard = {
        provider: "slack",
        source: label,
        url: room,
        total: messages.length,
        items: messages
          .toSorted((a, b) => Number(b.ts) - Number(a.ts))
          .slice(0, MEW_CARD_MAX)
          .map((m) => ({
            title: mentions(str(m.text)).slice(0, 280),
            url: `${room}/p${str(m.ts).replace(".", "")}`,
            icon: "message",
            author: who(m),
            at: Math.floor(Number(m.ts) * 1000),
            ...(typeof m.reply_count === "number" && { replies: m.reply_count }),
            ...(str(m.text).includes(`<@${str(me.user_id)}>`) && { mention: true }),
          })),
      };
      return { text, card };
    } catch (err) {
      if (err instanceof Notice) return { text: err.message };
      throw err;
    }
  },
  async send(env, userId, target, { text }) {
    const ctx = await connected(env, userId);
    const to = await resolve(ctx, target, () => people(ctx));
    const posted = await call(
      ctx,
      "chat.postMessage",
      { channel: to.channel, text, ...(to.thread && { thread_ts: to.thread }) },
      true,
    );
    // Posted already: a failed lookup only loses the link.
    const base = await call(ctx, "auth.test", {}).then(
      (me) => str(me.url),
      () => "",
    );
    const ts = str(posted.ts);
    if (!URL.canParse(base) || !/^\d+\.\d+$/.test(ts)) return {};
    const url = new URL(`archives/${to.channel}/p${ts.replace(".", "")}`, base);
    if (to.thread) url.searchParams.set("thread_ts", to.thread);
    return { url: url.href };
  },
};
