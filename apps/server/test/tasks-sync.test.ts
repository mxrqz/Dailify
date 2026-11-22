import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/auth", () => import("./session"));
import { mockSession } from "./session";

import { env, createExecutionContext } from "cloudflare:test";
import app from "../src/index";
import {
  insertTask,
  getTask,
  updateTask,
  setExdatesStatement,
  sweepTombstones,
  TOMBSTONE_TTL_MS,
} from "../src/db/tasks";
import { dropTasks, importTask } from "../src/db/calendar-sync";
import { encodeCursor, parseCursor } from "../src/lib/task-input";
import { taskHash } from "@dailify/shared";
import type { Task, TaskSync } from "@dailify/shared";

const make = (over: Partial<Task> = {}): Task => ({
  id: "sync1",
  title: "Dentista",
  date: new Date(2026, 7, 30, 15).getTime(),
  duration: "1h",
  priority: 0,
  repeat: "Off",
  completed: [],
  ...over,
});

const T0 = new Date(2026, 7, 30, 12).getTime();

describe("insertTask upsert (a fila offline reenvia)", () => {
  it("replays the same creation without duplicating or failing", async () => {
    const task = make({ id: "dup1", updatedAt: T0 });
    await insertTask(env.DB, "sync-u", task);
    const again = await insertTask(env.DB, "sync-u", task);

    expect(again?.id).toBe("dup1");
    const { results } = await env.DB.prepare("SELECT id FROM tasks WHERE id=?").bind("dup1").all();
    expect(results).toHaveLength(1);
  });

  it("a newer replay overwrites, an older one does not", async () => {
    await insertTask(env.DB, "sync-u", make({ id: "lww1", title: "primeira", updatedAt: T0 }));

    const newer = await insertTask(
      env.DB,
      "sync-u",
      make({ id: "lww1", title: "segunda", updatedAt: T0 + 1000 }),
    );
    expect(newer?.title).toBe("segunda");

    const older = await insertTask(
      env.DB,
      "sync-u",
      make({ id: "lww1", title: "atrasada", updatedAt: T0 - 1000 }),
    );
    expect(older?.title).toBe("segunda");
  });

  it("never writes over another user's row — the primary key is global", async () => {
    await insertTask(env.DB, "owner", make({ id: "steal1", title: "do dono", updatedAt: T0 }));
    const stolen = await insertTask(
      env.DB,
      "thief",
      make({ id: "steal1", title: "roubada", updatedAt: T0 + 1 }),
    );

    // null = nada foi criado; a rota transforma isso em 409 em vez de fingir sucesso.
    expect(stolen).toBeNull();
    const owned = await getTask(env.DB, "owner", "steal1");
    expect(owned?.title).toBe("do dono");
  });
});

describe("updateTask LWW", () => {
  it("ignores an edit older than what is stored", async () => {
    await insertTask(env.DB, "sync-u", make({ id: "edit1", title: "atual", updatedAt: T0 }));

    const stale = await updateTask(env.DB, "sync-u", "edit1", {
      title: "veio tarde",
      updatedAt: T0 - 60_000,
    });
    expect(stale?.title).toBe("atual");
  });

  it("skips the write when the content hash is unchanged", async () => {
    await insertTask(env.DB, "sync-u", make({ id: "noop1", title: "igual", updatedAt: T0 }));

    const same = await updateTask(env.DB, "sync-u", "noop1", {
      title: "igual",
      updatedAt: T0 + 60_000,
    });
    // Nada mudou, então o carimbo também não anda — senão cada sync inflaria o updatedAt.
    expect(same?.updatedAt).toBe(T0);
  });

  it("exposes a hash that matches the shared function", async () => {
    const stored = await getTask(env.DB, "sync-u", "noop1");
    expect(stored).not.toBeNull();
    if (!stored) return;
    expect(stored.hash).toBe(taskHash(stored));
  });
});

describe("GET /tasks/sync", () => {
  const DAY = 86_400_000;
  let uid = "";
  const id = (tag: string) => `${tag}-${crypto.randomUUID().slice(0, 8)}`;
  const call = (path: string, method = "GET") =>
    app.request(path, { method }, env, createExecutionContext());
  const pull = async (since?: string) => {
    const q = since === undefined ? "" : `&since=${since}`;
    const res = await call(`/tasks/sync?tz=America/Sao_Paulo${q}`);
    expect(res.status).toBe(200);
    return res.json<TaskSync>();
  };
  const ids = (body: TaskSync) => body.tasks.map((t) => t.id).sort();
  // Ages the user's rows and tombstones, so a cursor from 30 s ago sees none of them.
  const age = () =>
    env.DB.batch([
      env.DB.prepare(`UPDATE tasks SET changed_at=changed_at-60000 WHERE user_id=?`).bind(uid),
      env.DB.prepare(`UPDATE task_tombstones SET deleted_at=deleted_at-60000 WHERE user_id=?`).bind(
        uid,
      ),
    ]);
  const recent = () => encodeCursor(Date.now() - 30_000);

  beforeEach(() => {
    uid = `pull-${crypto.randomUUID()}`;
    mockSession(() => ({ id: uid }));
  });

  it("pulls the window in full: undated, recent and future one-offs, live series", async () => {
    const now = Date.now();
    const keep = [
      make({ id: id("undated"), date: now - 400 * DAY, undated: true }),
      make({ id: id("recent"), date: now - 100 * DAY }),
      make({ id: id("future"), date: now + 30 * DAY }),
      make({ id: id("oldseries"), date: now - 700 * DAY, repeat: "Daily" }),
      make({ id: id("ending"), date: now - 700 * DAY, repeat: "Daily", repeatUntil: now - DAY }),
    ];
    const drop = [
      make({ id: id("old"), date: now - 200 * DAY }),
      make({
        id: id("ended"),
        date: now - 700 * DAY,
        repeat: "Daily",
        repeatUntil: now - 300 * DAY,
      }),
    ];
    for (const t of [...keep, ...drop]) await insertTask(env.DB, uid, t);
    await insertTask(env.DB, "someone-else", make({ id: id("other"), date: now }));

    const body = await pull();
    expect(body.full).toBe(true);
    expect(body.deleted).toEqual([]);
    expect(ids(body)).toEqual(keep.map((t) => t.id).sort());
    // Raw rows: the series comes once, at its anchor.
    expect(body.tasks.find((t) => t.id === keep[3].id)?.date).toBe(keep[3].date);
    expect(parseCursor(body.cursor)).toBeLessThanOrEqual(Date.now());
  });

  it("answers a garbled, future or expired cursor in full", async () => {
    await insertTask(env.DB, uid, make({ id: id("t"), date: Date.now() }));
    await age();
    const bad = [
      "garbage",
      "!!",
      encodeCursor(Date.now() + DAY),
      encodeCursor(Date.now() - TOMBSTONE_TTL_MS - DAY),
    ];
    for (const since of bad) expect((await pull(since)).full).toBe(true);
    expect((await pull(recent())).full).toBe(false);
  });

  it("returns only rows changed since the cursor, a write with an old client stamp included", async () => {
    const stamp = Date.now() - DAY;
    const still = make({ id: id("still"), date: Date.now(), updatedAt: stamp });
    const edited = make({ id: id("edited"), date: Date.now(), updatedAt: stamp });
    await insertTask(env.DB, uid, still);
    await insertTask(env.DB, uid, edited);
    await insertTask(env.DB, "someone-else", make({ id: id("other"), date: Date.now() }));
    await age();

    await updateTask(env.DB, uid, edited.id, { title: "editada", updatedAt: stamp + 1 });
    // The offline queue replays a creation made long ago: an old updatedAt, a new change.
    const queued = make({ id: id("queued"), date: Date.now(), updatedAt: Date.now() - 300 * DAY });
    await insertTask(env.DB, uid, queued);

    const body = await pull(recent());
    expect(body.full).toBe(false);
    expect(ids(body)).toEqual([edited.id, queued.id].sort());
  });

  it("carries deletes in `deleted`, completions and exdates in `tasks`", async () => {
    const series = make({ id: id("series"), date: Date.now(), repeat: "Daily" });
    const one = make({ id: id("one"), date: Date.now() });
    const gone = make({ id: id("gone"), date: Date.now() });
    for (const t of [series, one, gone]) await insertTask(env.DB, uid, t);
    await age();

    expect((await call(`/tasks/${one.id}/complete`, "POST")).status).toBe(200);
    const skip = series.date + DAY;
    expect((await call(`/tasks/${series.id}?occurrence=${skip}`, "DELETE")).status).toBe(200);
    expect((await call(`/tasks/${gone.id}`, "DELETE")).status).toBe(204);

    let body = await pull(recent());
    expect(ids(body)).toEqual([series.id, one.id].sort());
    expect(body.tasks.find((t) => t.id === series.id)?.exdates).toEqual([skip]);
    expect(body.deleted).toEqual([gone.id]);

    await age();
    const done = body.tasks.find((t) => t.id === one.id)?.completed[0] ?? 0;
    expect((await call(`/tasks/${one.id}/complete?from=${done}&to=${done}`, "DELETE")).status).toBe(
      200,
    );
    body = await pull(recent());
    expect(ids(body)).toEqual([one.id]);
    expect(body.deleted).toEqual([]);
  });

  it("sees the Calendar sync's import, exdate and drop writes", async () => {
    const imported = make({ id: id("gcal"), date: Date.now(), repeat: "Daily" });
    const dropped = make({ id: id("gdrop"), date: Date.now() });
    await insertTask(env.DB, uid, dropped);
    await age();
    await importTask(
      env.DB,
      uid,
      imported,
      {
        taskId: imported.id,
        externalId: `ev-${imported.id}`,
        url: "https://calendar.google.com/x",
        timeZone: "UTC",
        imported: true,
        readonly: false,
        remoteUpdated: 1,
      },
      Date.now(),
    );
    await dropTasks(env.DB, uid, [dropped.id]);

    let body = await pull(recent());
    expect(ids(body)).toEqual([imported.id]);
    expect(body.deleted).toEqual([dropped.id]);

    await age();
    await setExdatesStatement(env.DB, uid, imported.id, [imported.date + DAY]).run();
    body = await pull(recent());
    expect(ids(body)).toEqual([imported.id]);
  });

  it("drops a re-created id's tombstone", async () => {
    const t = make({ id: id("back"), date: Date.now() });
    await insertTask(env.DB, uid, t);
    expect((await call(`/tasks/${t.id}`, "DELETE")).status).toBe(204);
    await insertTask(env.DB, uid, t);
    const body = await pull(recent());
    expect(ids(body)).toEqual([t.id]);
    expect(body.deleted).toEqual([]);
  });

  it("sweeps tombstones past their lifetime", async () => {
    await env.DB.prepare(
      `INSERT INTO task_tombstones (user_id, task_id, deleted_at) VALUES (?1,'ancient',?2),(?1,'fresh',?3)`,
    )
      .bind(uid, Date.now() - TOMBSTONE_TTL_MS - DAY, Date.now() - DAY)
      .run();
    await sweepTombstones(env.DB);
    const { results } = await env.DB.prepare(`SELECT task_id FROM task_tombstones WHERE user_id=?`)
      .bind(uid)
      .all<{ task_id: string }>();
    expect(results.map((r) => r.task_id)).toEqual(["fresh"]);
  });
});
