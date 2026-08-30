import { describe, it, expect, beforeAll } from "vitest";
import { env, applyD1Migrations } from "cloudflare:test";
import { insertTask, getTask, updateTask } from "../src/db/tasks";
import { taskHash } from "@dailify/shared";
import type { Task } from "@dailify/shared";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});

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

    expect(again.id).toBe("dup1");
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
    expect(newer.title).toBe("segunda");

    const older = await insertTask(
      env.DB,
      "sync-u",
      make({ id: "lww1", title: "atrasada", updatedAt: T0 - 1000 }),
    );
    expect(older.title).toBe("segunda");
  });

  it("never writes over another user's row — the primary key is global", async () => {
    await insertTask(env.DB, "owner", make({ id: "steal1", title: "do dono", updatedAt: T0 }));
    await insertTask(env.DB, "thief", make({ id: "steal1", title: "roubada", updatedAt: T0 + 1 }));

    const owned = await getTask(env.DB, "owner", "steal1");
    expect(owned?.title).toBe("do dono");
    expect(await getTask(env.DB, "thief", "steal1")).toBeNull();
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
