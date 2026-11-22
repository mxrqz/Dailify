import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  authClient: { $store: { notify: vi.fn() } },
  authHeaders: () => ({}),
}));
vi.mock("@/lib/auth", () => auth);

import { createCalendarEvent, createTaskVoice, deleteTask, syncTasks } from "./api";

const fetchMock = vi.fn<typeof fetch>();
const respond = (status: number, body: string) =>
  fetchMock.mockResolvedValueOnce(new Response(body, { status }));

beforeEach(() => vi.stubGlobal("fetch", fetchMock));
afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
  auth.authClient.$store.notify.mockReset();
});

describe("request", () => {
  it("sends the cursor and the app zone to the pull", async () => {
    respond(200, JSON.stringify({ full: false, tasks: [], deleted: [], cursor: "c2" }));
    const { sync } = await syncTasks("a/b");
    expect(sync?.cursor).toBe("c2");
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/tasks\/sync\?since=a%2Fb&tz=/);
  });

  it("reports a rejected fetch as offline", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const { sync, error } = await syncTasks();
    expect(sync).toBeUndefined();
    expect(error?.offline).toBe(true);
  });

  it("turns an HTML 502 into a status-only error", async () => {
    respond(502, "<html>Bad gateway</html>");
    const { error } = await syncTasks();
    expect(error).toMatchObject({ offline: false, status: 502, code: undefined });
    expect(error?.message).toContain("502");
  });

  it("fires the session signal on a 401", async () => {
    respond(401, JSON.stringify({ error: "Unauthorized" }));
    const { error } = await syncTasks();
    expect(error).toMatchObject({ status: 401, message: "Unauthorized" });
    expect(auth.authClient.$store.notify).toHaveBeenCalledWith("$sessionSignal");
  });

  it("passes a failed response's body through on a 409", async () => {
    const link = { provider: "google-calendar", externalId: "e1" };
    const task = { id: "t1" };
    respond(409, JSON.stringify({ error: "Already linked", code: "already_linked", link, task }));
    const result = await createCalendarEvent("t1", false);
    expect(result.error).toMatchObject({ status: 409, code: "already_linked" });
    expect(result.link).toEqual(link);
    expect(result.task).toEqual(task);
  });

  it("sends FormData without the JSON Content-Type and keeps the error status", async () => {
    respond(429, JSON.stringify({ error: "AI Credits Limit Reached" }));
    const { tasks, error } = await createTaskVoice(new FormData());
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.has("Content-Type")).toBe(false);
    expect(tasks).toEqual([]);
    expect(error?.status).toBe(429);
  });

  it("encodes the task id in the path", async () => {
    respond(200, "{}");
    await deleteTask("a/b");
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/tasks\/a%2Fb$/);
  });

  it("sends a queued delete's stamp", async () => {
    respond(200, "{}");
    await deleteTask("a", undefined, 5);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/tasks\/a\?updatedAt=5$/);
  });
});
