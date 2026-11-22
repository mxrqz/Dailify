import { afterAll, afterEach, beforeAll } from "vitest";

// workerd fires `unhandledrejection` for a rejected promise an async function returns before the
// caller adopts it, then `rejectionhandled` a microtask later. Better Auth does that with every
// APIError (better-call's `.catch(async (e) => { throw e })`), and vitest reports the first event
// alone; with a listener of ours it reports nothing, so this fails what stays unhandled instead.
export const pending = new Map<Promise<unknown>, unknown>();
const onUnhandled = (reason: unknown, promise: Promise<unknown>) => pending.set(promise, reason);
const onHandled = (promise: Promise<unknown>) => pending.delete(promise);

beforeAll(() => {
  process.on("unhandledRejection", onUnhandled);
  process.on("rejectionHandled", onHandled);
});

async function failOnUnhandled() {
  await new Promise((resolve) => setTimeout(resolve));
  const reasons = [...pending.values()];
  pending.clear();
  if (reasons.length) throw reasons[0];
}

afterEach(failOnUnhandled);

afterAll(async () => {
  await failOnUnhandled();
  process.off("unhandledRejection", onUnhandled);
  process.off("rejectionHandled", onHandled);
});
