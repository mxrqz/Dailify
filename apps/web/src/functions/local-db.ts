import type { Task } from "@dailify/shared";

import type { Mutation } from "./offline";

/**
 * One IndexedDB per user: `tasks` (stored rows by id), `outbox` (the queue under `queue`), `meta`
 * (`cursor`, `pulledAt`). Plain IDB, no wrapper lib: three stores and whole-store reads need ~60
 * lines. Every call resolves `undefined` when IDB is missing or throws (private mode, node tests):
 * callers keep their in-memory copy and the app runs without persistence.
 */
const VERSION = 1;
const STORES = ["tasks", "outbox", "meta"];

export const localDbName = (userId: string) => `dailify:${userId}`;

const opened = new Map<string, Promise<IDBDatabase>>();

function open(userId: string): Promise<IDBDatabase> {
  const cached = opened.get(userId);
  if (cached) return cached;
  const db = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(localDbName(userId), VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("tasks", { keyPath: "id" });
      req.result.createObjectStore("outbox");
      req.result.createObjectStore("meta");
    };
    req.onsuccess = () => {
      // A delete (clearLocal, another tab) waits on open connections: let go of ours.
      req.result.onversionchange = () => {
        req.result.close();
        forget();
      };
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
  const forget = () => {
    if (opened.get(userId) === db) opened.delete(userId);
  };
  db.catch(forget);
  opened.set(userId, db);
  return db;
}

// One transaction over every store; `body` queues the requests and returns what to resolve with.
async function run<T>(
  userId: string,
  mode: IDBTransactionMode,
  body: (tx: IDBTransaction) => () => T,
): Promise<T | undefined> {
  try {
    const db = await open(userId);
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORES, mode);
      const result = body(tx);
      tx.oncomplete = () => resolve(result());
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
    return undefined;
  }
}

export interface LocalData {
  rows: Task[];
  queue?: Mutation[];
  cursor?: string;
}

export const loadLocal = (userId: string): Promise<LocalData | undefined> =>
  run(userId, "readonly", (tx) => {
    const rows = tx.objectStore("tasks").getAll();
    const queue = tx.objectStore("outbox").get("queue");
    const cursor = tx.objectStore("meta").get("cursor");
    return () => ({ rows: rows.result, queue: queue.result, cursor: cursor.result });
  });

/** Puts `put` and deletes `drop`; `replace` clears the store first (a full pull). */
export const saveRows = (userId: string, put: Task[], drop: string[], replace = false) =>
  run(userId, "readwrite", (tx) => {
    const tasks = tx.objectStore("tasks");
    if (replace) tasks.clear();
    for (const id of drop) tasks.delete(id);
    for (const row of put) tasks.put(row);
    return () => true;
  });

/** Read-modify-write in one transaction, so another tab's entries are never written over. */
export const updateQueue = (userId: string, update: (queue: Mutation[]) => Mutation[]) =>
  run(userId, "readwrite", (tx) => {
    const outbox = tx.objectStore("outbox");
    const req = outbox.get("queue");
    let next: Mutation[] = [];
    req.onsuccess = () => {
      next = update(req.result ?? []);
      outbox.put(next, "queue");
    };
    return () => next;
  });

export const saveMeta = (userId: string, meta: { cursor?: string; pulledAt?: number }) =>
  run(userId, "readwrite", (tx) => {
    const store = tx.objectStore("meta");
    for (const [key, value] of Object.entries(meta))
      if (value === undefined) store.delete(key);
      else store.put(value, key);
    return () => true;
  });

// Synchronous on purpose: an open issued right after queues behind the delete, never before it.
export function deleteLocal(userId: string): void {
  const db = opened.get(userId);
  opened.delete(userId);
  try {
    indexedDB.deleteDatabase(localDbName(userId));
  } catch {
    /* no IndexedDB: nothing was stored */
  }
  db?.then(
    (conn) => conn.close(),
    () => undefined,
  );
}
