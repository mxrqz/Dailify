import { describe, it, expect, vi, beforeEach } from "vitest";

let userId = "";
let plan: "free" | "pro" = "pro";
vi.mock("../src/auth", () => import("./session"));
import { mockSession } from "./session";
mockSession(() => ({ id: userId, plan }));

import { env } from "cloudflare:workers";
import app from "../src/index";
import { github, syncGithub } from "../src/integrations/github";
import { openTokens, sealTokens } from "../src/integrations/connection";
import { getConnection, listProviderLinks, upsertConnection } from "../src/db/integrations";
import { getTask } from "../src/db/tasks";

const API = "https://api.github.com";
const ORIGIN = "https://mewki.mxrqz.com";
const SCOPE = "repo,read:user";
const CLOSED_AT = "2026-11-20T15:00:00Z";

const issue = (repo: string, number: number, extra: object = {}) => ({
  number,
  title: `Item ${number}`,
  state: "open",
  html_url: `https://github.com/${repo}/issues/${number}`,
  repository_url: `${API}/repos/${repo}`,
  ...extra,
});
const ISSUE = issue("acme/app", 1);
const PR = issue("acme/app", 2, {
  html_url: "https://github.com/acme/app/pull/2",
  pull_request: { url: `${API}/repos/acme/app/pulls/2` },
});

let routes: Record<string, (init?: RequestInit) => Response>;
let calls: { url: string; method: string; headers: Headers; body: string }[];

beforeEach(() => {
  userId = `github-${crypto.randomUUID()}`;
  plan = "pro";
  calls = [];
  routes = {
    "https://github.com/login/oauth/access_token": () =>
      Response.json({ access_token: "gho_1", token_type: "bearer", scope: SCOPE }),
    [`${API}/user`]: () => Response.json({ id: 42, login: "octo" }),
    [`${API}/issues`]: () => Response.json([ISSUE, PR], { headers: { etag: 'W/"v1"' } }),
    [`${API}/applications/test-github-client/grant`]: () => new Response(null, { status: 204 }),
  };
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push({
      url,
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: String(init?.body ?? ""),
    });
    const route = routes[url.split("?")[0]];
    if (!route) throw new Error(`fetch não mockado: ${url}`);
    return route(init);
  });
});

const callsTo = (path: string) => calls.filter((c) => c.url.split("?")[0] === path);
const request = (path: string, init: RequestInit = {}) =>
  app.request(path, { ...init, headers: { origin: ORIGIN, ...init.headers } }, env);

async function seed() {
  const tokens = { accessToken: "gho_1", expiresAt: Date.now() + 3_600_000, scope: SCOPE };
  await upsertConnection(
    env.DB,
    userId,
    "github",
    {
      accountId: "42",
      email: "octo",
      scopes: SCOPE,
      tokens: await sealTokens(env, userId, "github", tokens),
    },
    Date.now(),
  );
}

const tasksOf = async () => {
  const links = await listProviderLinks(env.DB, userId, "github");
  return Promise.all(
    links.map(async (l) => ({ ref: l.externalId, task: await getTask(env.DB, userId, l.taskId) })),
  );
};

describe("GitHub connect and callback", () => {
  it("asks for repo and read:user, stores the sealed token and imports on connect", async () => {
    const res = await request("/integrations/github/connect", { method: "POST" });
    const url = new URL((await res.json<{ url: string }>()).url);
    expect(url.origin + url.pathname).toBe("https://github.com/login/oauth/authorize");
    expect(url.searchParams.get("scope")).toBe("repo read:user");
    expect(url.searchParams.get("redirect_uri")).toBe(`${ORIGIN}/integrations/github/callback`);

    const done = await request("/integrations/github/callback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: "c", state: url.searchParams.get("state") }),
    });
    expect(done.status).toBe(200);
    expect(await done.json()).toMatchObject({ connected: true, account: "octo", imported: 2 });
    const user = callsTo(`${API}/user`)[0].headers;
    expect(user.get("authorization")).toBe("Bearer gho_1");
    expect(user.get("user-agent")).toBe("Mewki");
    expect(user.get("x-github-api-version")).toBe("2022-11-28");

    const row = await getConnection(env.DB, userId, "github");
    expect(row?.tokens).not.toContain("gho_");
    expect(await openTokens(env, userId, "github", row?.tokens ?? "")).toMatchObject({
      accessToken: "gho_1",
      scope: SCOPE,
    });
  });

  it("is Pro and up: Free gets 403 on connect", async () => {
    plan = "free";
    expect((await request("/integrations/github/connect", { method: "POST" })).status).toBe(403);
  });
});

describe("GitHub import", () => {
  beforeEach(seed);

  it("assigned issues and PRs become undated tasks linked by owner/repo#n", async () => {
    expect(await syncGithub(env, userId, 0)).toEqual({ imported: 2 });
    expect(new URL(callsTo(`${API}/issues`)[0].url).searchParams.get("filter")).toBe("assigned");
    const got = await tasksOf();
    expect(got.map((g) => g.ref).sort()).toEqual(["acme/app#1", "acme/app#2"]);
    expect(got.find((g) => g.ref === "acme/app#2")?.task).toMatchObject({
      title: "Item 2",
      undated: true,
      links: ["https://github.com/acme/app/pull/2"],
      completed: [],
    });
    // A second pass imports nothing twice.
    expect(await syncGithub(env, userId, 0)).toEqual({ imported: 0 });
  });

  it("sends the stored ETag and a 304 changes nothing", async () => {
    await syncGithub(env, userId, 0);
    routes[`${API}/issues`] = () => new Response(null, { status: 304 });
    expect(await syncGithub(env, userId, 0)).toEqual({ imported: 0 });
    expect(callsTo(`${API}/issues`)[1].headers.get("if-none-match")).toBe('W/"v1"');
    expect(await tasksOf()).toHaveLength(2);
  });

  it("throttles a pass within five minutes", async () => {
    await syncGithub(env, userId, 0);
    await syncGithub(env, userId);
    expect(callsTo(`${API}/issues`)).toHaveLength(1);
  });

  it("closed completes the task at closed_at; unassigned keeps the task and drops the link", async () => {
    await syncGithub(env, userId, 0);
    routes[`${API}/issues`] = () => Response.json([], { headers: { etag: 'W/"v2"' } });
    routes[`${API}/repos/acme/app/issues/1`] = () =>
      Response.json({ ...ISSUE, state: "closed", closed_at: CLOSED_AT });
    routes[`${API}/repos/acme/app/issues/2`] = () => Response.json(PR);
    const before = await tasksOf();
    await syncGithub(env, userId, 0);

    const after = await tasksOf();
    expect(after.map((g) => g.ref)).toEqual(["acme/app#1"]);
    expect(after[0].task?.completed).toEqual([Date.parse(CLOSED_AT)]);
    const unassigned = before.find((g) => g.ref === "acme/app#2")?.task;
    expect(await getTask(env.DB, userId, unassigned?.id ?? "")).toMatchObject({ title: "Item 2" });

    // Done in Mewki: never checked again.
    routes[`${API}/issues`] = () => Response.json([], { headers: { etag: 'W/"v3"' } });
    await syncGithub(env, userId, 0);
    expect(callsTo(`${API}/repos/acme/app/issues/1`)).toHaveLength(1);
  });

  it("a 401 marks the connection revoked", async () => {
    routes[`${API}/issues`] = () => new Response("", { status: 401 });
    await expect(syncGithub(env, userId, 0)).rejects.toThrow(/revoked/);
    expect((await getConnection(env.DB, userId, "github"))?.status).toBe("revoked");
  });
});

describe("GitHub read", () => {
  beforeEach(seed);

  it("*: open assigned items and review requests", async () => {
    routes[`${API}/search/issues`] = () =>
      Response.json({ items: [issue("acme/api", 7, { pull_request: {}, title: "Bump" })] });
    const text = await github.read?.(env, userId, "*");
    expect(new URL(callsTo(`${API}/search/issues`)[0].url).searchParams.get("q")).toBe(
      "is:open is:pr review-requested:@me",
    );
    expect(text).toBe(
      [
        "Assigned to the user, open:\n- acme/app#1: Item 1\n- acme/app#2 (PR): Item 2",
        "Pull requests waiting for the user's review:\n- acme/api#7 (PR): Bump",
      ].join("\n\n"),
    );
  });

  it("owner/repo#n: the item, its body and the last page of comments", async () => {
    routes[`${API}/repos/acme/app/issues/1`] = () =>
      Response.json({ ...ISSUE, body: "Steps to reproduce", user: { login: "ana" }, comments: 12 });
    routes[`${API}/repos/acme/app/issues/1/comments`] = () =>
      Response.json([
        { user: { login: "bia" }, created_at: "2026-11-21T10:00:00Z", body: "Same here" },
      ]);
    const text = await github.read?.(env, userId, "acme/app#1");
    expect(
      new URL(callsTo(`${API}/repos/acme/app/issues/1/comments`)[0].url).searchParams.get("page"),
    ).toBe("2");
    expect(text).toContain("acme/app#1 [open]: Item 1");
    expect(text).toContain("Steps to reproduce");
    expect(text).toContain("@bia (2026-11-21): Same here");
  });

  it("an unknown item reads back as a note", async () => {
    routes[`${API}/repos/acme/app/issues/9`] = () => new Response("", { status: 404 });
    expect(await github.read?.(env, userId, "https://github.com/acme/app/pull/9")).toMatch(
      /Nothing on GitHub/,
    );
  });
});

describe("GitHub disconnect", () => {
  beforeEach(seed);

  it("deletes the grant with basic auth and the row", async () => {
    expect((await request("/integrations/github", { method: "DELETE" })).status).toBe(204);
    const revoke = callsTo(`${API}/applications/test-github-client/grant`)[0];
    expect(revoke.method).toBe("DELETE");
    expect(revoke.headers.get("authorization")).toBe(
      `Basic ${btoa("test-github-client:test-github-secret")}`,
    );
    expect(JSON.parse(revoke.body)).toEqual({ access_token: "gho_1" });
    expect(await getConnection(env.DB, userId, "github")).toBeNull();
  });
});
