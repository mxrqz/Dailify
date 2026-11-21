import {
  TASK_LIMITS,
  durationMinutes,
  doneThisPeriod,
  expandRecurringTask,
  isDuration,
  isRecord,
  isoDate,
  isoWallTime,
  normalizeRepeat,
  periodStart,
  weekDays,
  zonedEpoch,
  zonedParts,
  type Task,
  type WeekStart,
} from "@dailify/shared";
import { getTask, getUndatedTasks, readMonth } from "../db/tasks";
import { DATE_ONLY_RE, draftToTask, toDraft, toEpoch } from "./openai";

// Remote MCP over streamable HTTP, stateless: one JSON-RPC message per POST, no sessions, no SSE.
export const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"];

export interface ToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

export type RpcReply = { status: 200 | 400; body: Record<string, unknown> } | { status: 202 };

const INSTRUCTIONS = `Mewki is the user's task agenda. Every time you read or write is local wall time in the user's
time zone ("YYYY-MM-DDTHH:mm"); list_tasks reports the zone and today's date. Instances of a
recurring task share the series id: pass occurrence ("YYYY-MM-DD", the day of the instance) to
act on that one day.`;

const rpcError = (
  id: unknown,
  code: number,
  message: string,
  status: 200 | 400 = 200,
): RpcReply => ({
  status,
  body: { jsonrpc: "2.0", id, error: { code, message } },
});

const isId = (v: unknown): v is string | number => typeof v === "string" || typeof v === "number";

/** One JSON-RPC message in, the HTTP reply out. `call` runs a tool already known to exist. */
export async function handleRpc(
  text: string,
  call: (name: string, args: Record<string, unknown>) => Promise<ToolResult>,
  version: string,
): Promise<RpcReply> {
  let msg: unknown;
  try {
    msg = JSON.parse(text);
  } catch {
    return rpcError(null, -32700, "Parse error", 400);
  }
  if (!isRecord(msg) || msg.jsonrpc !== "2.0")
    return rpcError(null, -32600, "Invalid Request", 400);
  // A response to us, or a notification: nothing to answer.
  if (msg.method === undefined && (Object.hasOwn(msg, "result") || Object.hasOwn(msg, "error")))
    return { status: 202 };
  if (typeof msg.method !== "string") return rpcError(null, -32600, "Invalid Request", 400);
  if (msg.id === undefined) return { status: 202 };
  if (!isId(msg.id)) return rpcError(null, -32600, "Invalid Request", 400);

  const id = msg.id;
  const params = isRecord(msg.params) ? msg.params : {};
  const ok = (result: unknown): RpcReply => ({
    status: 200,
    body: { jsonrpc: "2.0", id, result },
  });
  switch (msg.method) {
    case "initialize":
      return ok({
        protocolVersion:
          PROTOCOL_VERSIONS.find((v) => v === params.protocolVersion) ?? PROTOCOL_VERSIONS[0],
        capabilities: { tools: {} },
        serverInfo: { name: "mewki", version },
        instructions: INSTRUCTIONS,
      });
    case "ping":
      return ok({});
    case "tools/list":
      return ok({ tools: TOOLS });
    case "tools/call": {
      const name = params.name;
      if (typeof name !== "string" || !TOOLS.some((t) => t.name === name))
        return rpcError(id, -32602, `Unknown tool: ${String(name)}`);
      return ok(await call(name, isRecord(params.arguments) ? params.arguments : {}));
    }
    default:
      return rpcError(id, -32601, `Method not found: ${msg.method}`);
  }
}

const day = { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" };
const id = { type: "string", description: "Task id, as list_tasks returns it." };
const occurrence = {
  ...day,
  description: "For a recurring task: the day (YYYY-MM-DD) of the instance to act on.",
};
const fields = {
  title: { type: "string", maxLength: TASK_LIMITS.titleMax },
  duration: {
    type: "string",
    pattern: "^(\\d{1,3}h)?(\\d{1,4}m)?$",
    description: 'e.g. "30m", "1h30m".',
  },
  priority: {
    type: "integer",
    minimum: 0,
    maximum: TASK_LIMITS.priorityMax,
    description: "0 = none, 4 = highest.",
  },
  repeat: {
    type: "string",
    enum: ["Off", "Daily", "Weekly", "Monthly", "Yearly"],
    description: "Recurrence, phased on the task's date. Weekly needs weekdays.",
  },
  weekdays: { type: "array", items: { type: "string", enum: weekDays } },
  repeatEvery: {
    type: "integer",
    minimum: 2,
    maximum: TASK_LIMITS.repeatEveryMax,
    description: "Every N days/weeks/months/years of repeat; omit for every one.",
  },
  tags: { type: "array", items: { type: "string" } },
  links: { type: "array", items: { type: "string", format: "uri" } },
};
const write = { readOnlyHint: false, openWorldHint: false };

export const TOOLS = [
  {
    name: "list_tasks",
    description:
      "List the user's tasks from one day to another (inclusive, local days), with recurring instances expanded. Also states the user's time zone and today's date.",
    inputSchema: {
      type: "object",
      properties: {
        from: { ...day, description: "First day, YYYY-MM-DD." },
        to: { ...day, description: "Last day, YYYY-MM-DD; defaults to from. At most 92 days." },
        includeUndated: {
          type: "boolean",
          description: 'Also list the undated ("no date") tasks.',
        },
      },
      required: ["from"],
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "create_task",
    description:
      'Create a task. With date "YYYY-MM-DDTHH:mm" it goes on the agenda at that local time; with only "YYYY-MM-DD" it becomes an undated task with a 09:00 reminder that day; without date it is undated.',
    inputSchema: {
      type: "object",
      properties: { ...fields, date: { type: "string", description: "Local time." } },
      required: ["title"],
    },
    annotations: write,
  },
  {
    name: "update_task",
    description:
      "Change a task's fields; omitted fields stay. On a recurring task, occurrence alone edits only that day's instance; without occurrence, or with series: true, the whole series changes, and a new date then moves every instance by the same shift.",
    inputSchema: {
      type: "object",
      properties: {
        id,
        occurrence,
        series: { type: "boolean", description: "With occurrence: apply to the whole series." },
        ...fields,
        date: { type: "string", description: 'New local start, "YYYY-MM-DDTHH:mm".' },
        undated: { type: "boolean", description: "true moves the task out of the agenda." },
      },
      required: ["id"],
    },
    annotations: { ...write, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "complete_task",
    description:
      "Mark a task done (or not done again, with undo: true). A recurring dated task needs occurrence.",
    inputSchema: {
      type: "object",
      properties: { id, occurrence, undo: { type: "boolean" } },
      required: ["id"],
    },
    annotations: { ...write, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "delete_task",
    description:
      "Delete a task. On a recurring task, occurrence deletes only that day; without it the whole series is deleted.",
    inputSchema: { type: "object", properties: { id, occurrence }, required: ["id"] },
    annotations: { ...write, destructiveHint: true, idempotentHint: true },
  },
];

/** What a tool needs; `send` is one call into the tasks module as this user. */
export interface McpContext {
  db: D1Database;
  userId: string;
  timeZone: string;
  weekStart: WeekStart;
  now: number;
  send: (
    method: string,
    path: string,
    body?: unknown,
  ) => Promise<{ status: number; body: unknown }>;
}

const text = (value: unknown, isError = false): ToolResult => ({
  content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value) }],
  ...(isError && { isError }),
});
const failed = (message: string) => text(message, true);

// Enough of a Task to show; the tasks module built it, this only gets the type back without `as`.
const isTask = (v: unknown): v is Task =>
  isRecord(v) &&
  typeof v.id === "string" &&
  typeof v.date === "number" &&
  Array.isArray(v.completed);

export async function callTool(
  ctx: McpContext,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const { timeZone: tz, now } = ctx;
  const wall = (ms: number) => isoWallTime(zonedParts(ms, tz)).slice(0, 16);
  const dayOf = (ms: number) => isoDate(zonedParts(ms, tz));
  const midnight = (ms: number, days = 0) => {
    const p = zonedParts(ms, tz);
    return zonedEpoch({ ...p, day: p.day + days, hour: 0, minute: 0, second: 0, ms: 0 }, tz);
  };
  const doneOn = (t: Task) =>
    t.undated
      ? t.repeat === "Off"
        ? t.completed.length > 0
        : doneThisPeriod(t, now, ctx.weekStart, tz)
      : t.completed.some((c) => c >= midnight(t.date) && c < midnight(t.date, 1));
  const view = (t: Task) => ({
    id: t.id,
    title: t.title,
    ...(t.undated
      ? { undated: true, ...(t.alert !== undefined && { reminder: wall(t.alert) }) }
      : { start: wall(t.date), duration: t.duration }),
    done: doneOn(t),
    ...(t.priority > 0 && { priority: t.priority }),
    ...(t.repeat !== "Off" && { repeat: t.repeat, repeatEvery: t.repeatEvery }),
    ...(t.tags?.length ? { tags: t.tags } : {}),
    ...(t.links?.length ? { links: t.links } : {}),
  });
  /** The reply's task, or the route's own error text. */
  const reply = async (method: string, path: string, body?: unknown) => {
    const res = await ctx.send(method, path, body);
    if (res.status >= 300) {
      const error = isRecord(res.body) && typeof res.body.error === "string" ? res.body.error : "";
      return failed(`Failed (${res.status}) ${error}`.trim());
    }
    return text(
      isRecord(res.body) && isTask(res.body.task) ? { task: view(res.body.task) } : { ok: true },
    );
  };

  if (name === "list_tasks") {
    const from =
      typeof args.from === "string" && DATE_ONLY_RE.test(args.from) ? toEpoch(args.from, tz) : null;
    const toDay = args.to ?? args.from;
    const last = typeof toDay === "string" && DATE_ONLY_RE.test(toDay) ? toEpoch(toDay, tz) : null;
    if (from === null || last === null) return failed("from and to must be YYYY-MM-DD days");
    const end = midnight(last, 1);
    // ponytail: 92 days caps the month reads at four; a search tool can come when people need more.
    if (end <= from || end - from > 92 * 86_400_000)
      return failed("to must be 0 to 92 days after from");

    const months: Date[] = [];
    const stop = zonedParts(end - 1, tz);
    for (let { year, month } = zonedParts(from, tz); ; month++) {
      if (month === 12) [year, month] = [year + 1, 0];
      months.push(new Date(year, month, 1));
      if (year === stop.year && month === stop.month) break;
    }
    const read = await Promise.all(months.map((m) => readMonth(ctx.db, ctx.userId, m, tz)));
    const byKey = new Map(read.flat().map((t) => [`${t.id}-${t.date}`, t]));
    const tasks = [...byKey.values()]
      .filter((t) => t.date < end && t.date + durationMinutes(t.duration) * 60_000 > from)
      .sort((a, b) => a.date - b.date);
    const undated = args.includeUndated === true ? await getUndatedTasks(ctx.db, ctx.userId) : null;
    return text({
      timeZone: tz,
      today: dayOf(now),
      tasks: tasks.map(view),
      ...(undated && { undated: undated.map(view) }),
    });
  }

  if (name === "create_task") {
    if (typeof args.title !== "string") return failed("title required");
    const repeat = repeatOf(args);
    if (repeat === "invalid") return failed("invalid repeat");
    let task: Task;
    try {
      const draft = toDraft(
        {
          title: args.title,
          date: typeof args.date === "string" ? args.date : null,
          duration: typeof args.duration === "string" ? args.duration : null,
          repeat: repeat ?? "Off",
          repeatEvery: args.repeatEvery,
          links: Array.isArray(args.links) ? args.links.filter((l) => typeof l === "string") : [],
        },
        tz,
        [],
      );
      task = draftToTask(draft, tz, now);
    } catch {
      return failed('date must be local "YYYY-MM-DDTHH:mm" or "YYYY-MM-DD"');
    }
    return reply("POST", "/", {
      ...task,
      ...(args.priority !== undefined && { priority: args.priority }),
      ...(args.tags !== undefined && { tags: args.tags }),
    });
  }

  if (typeof args.id !== "string") return failed("id required");
  const task = await getTask(ctx.db, ctx.userId, args.id);
  if (!task) return failed("Task not found");
  const path = `/${encodeURIComponent(task.id)}`;
  const recurring = task.repeat !== "Off" && !task.undated;
  let at: number | undefined;
  if (recurring && args.occurrence !== undefined) {
    const found =
      typeof args.occurrence === "string" ? occurrenceOn(task, args.occurrence, tz) : null;
    if (found === null) return failed(`No instance of this task on ${String(args.occurrence)}`);
    at = found;
  }

  if (name === "update_task") {
    const patch: Record<string, unknown> = {};
    for (const key of ["title", "priority", "repeatEvery", "tags", "links", "undated"])
      if (args[key] !== undefined) patch[key] = args[key];
    if (args.duration !== undefined) {
      if (!isDuration(args.duration)) return failed('duration like "30m" or "1h30m"');
      patch.duration = args.duration;
    }
    const repeat = repeatOf(args);
    if (repeat === "invalid") return failed("invalid repeat");
    if (repeat) patch.repeat = repeat;
    if (args.date !== undefined) {
      const date =
        typeof args.date === "string" && !DATE_ONLY_RE.test(args.date)
          ? toEpoch(args.date, tz)
          : null;
      if (date === null) return failed('date must be local "YYYY-MM-DDTHH:mm"');
      patch.date = date;
    }
    if (at !== undefined && args.series !== true)
      return reply("PATCH", `${path}?occurrence=${at}`, patch);
    // A series write moves the anchor by the shift asked of the instance (RULES.md, Frontend).
    if (typeof patch.date === "number" && at !== undefined)
      patch.date = task.date + patch.date - at;
    return reply("PATCH", path, patch);
  }

  if (name === "complete_task") {
    if (recurring && at === undefined) return failed("occurrence required for a recurring task");
    if (args.undo === true) {
      const [from, to] = task.undated
        ? [
            task.repeat === "Off"
              ? 0
              : periodStart(task.repeat, now, ctx.weekStart, tz, task.repeatEvery, task.date),
            now,
          ]
        : [midnight(at ?? task.date), midnight(at ?? task.date, 1) - 1];
      return reply("DELETE", `${path}/complete?from=${from}&to=${to}`);
    }
    // Mirrors the web: done today stamps now, another day stamps the instance itself.
    const when = at ?? task.date;
    const stamp = task.undated || dayOf(when) === dayOf(now) ? now : when;
    return reply("POST", `${path}/complete`, { at: stamp });
  }

  // delete_task
  const res = await ctx.send("DELETE", at === undefined ? path : `${path}?occurrence=${at}`);
  if (res.status >= 300) return failed(`Failed (${res.status})`);
  return text(
    at === undefined ? `Deleted "${task.title}"` : `Deleted "${task.title}" on ${dayOf(at)}`,
  );
}

/** `repeat` (+ `weekdays`) as a `Repeat`; undefined when absent. */
function repeatOf(args: Record<string, unknown>) {
  if (args.repeat === undefined) return undefined;
  const raw = args.repeat === "Weekly" ? { Weekly: args.weekdays } : args.repeat;
  const repeat = normalizeRepeat(raw);
  return repeat === "Off" && raw !== "Off" ? "invalid" : repeat;
}

/** The epoch-ms of the series instance on a local day, or null when none falls there. */
export function occurrenceOn(task: Task, day: string, timeZone: string): number | null {
  const ms = DATE_ONLY_RE.test(day) ? toEpoch(day, timeZone) : null;
  if (ms === null) return null;
  const p = zonedParts(ms, timeZone);
  const own = task.exdates?.includes(task.date) ? [] : [task];
  const instances = [...own, ...expandRecurringTask(task, new Date(p.year, p.month, 1), timeZone)];
  return instances.find((t) => isoDate(zonedParts(t.date, timeZone)) === day)?.date ?? null;
}
