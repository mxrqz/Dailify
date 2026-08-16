import { Hono } from "hono";
import { nanoid } from "nanoid";
import { DateTime } from "luxon";
import type { User } from "@clerk/backend";
import { normalizeRepeat, PLAN_PERMISSIONS, type Task } from "@dailify/shared";
import type { Env } from "../index";
import { requireAuth } from "../middleware/auth";
import { clerk, getUserRole } from "../lib/clerk";
import { transcribe, generateTasks } from "../lib/openai";
import { insertTask } from "../db/tasks";
import { enforceCreate } from "../db/limits";
import { fail } from "../lib/errors";

const voice = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

function readTimezone(user: User): string | undefined {
  const tz = user.unsafeMetadata?.timezone;
  return typeof tz === "string" ? tz : undefined;
}

// GPT is prompted to emit naive local ISO strings with no 'Z'/offset (see lib/openai.ts's PROMPT) —
// it reasons using a "now" already expressed as naive local time in the user's timezone, so its output
// wall-clock values are meant as local time, not UTC. The regex strip below is belt-and-suspenders in
// case GPT disobeys and tags a 'Z' or offset anyway. We reinterpret the wall-clock components as local
// to `timeZone` before converting to a real UTC instant.
function formatToUTC(iso: string, timeZone: string): number | null {
  const local = iso.replace(/(Z|[+-]\d{2}:?\d{2})$/, "");
  const dt = DateTime.fromISO(local, { zone: timeZone });
  return dt.isValid ? dt.toUTC().toMillis() : null;
}

voice.post("/voice", requireAuth, async (c) => {
  const userId = c.get("userId");
  const role = await getUserRole(c.env, userId);
  if (!PLAN_PERMISSIONS[role].features.voiceCreation) {
    return fail(c, 403, "Voice not available on your plan");
  }

  const body = await c.req.parseBody();
  const audio = body["audio"];
  if (!(audio instanceof File)) return fail(c, 400, "No audio");

  // Cap upload size — guards OpenAI cost/abuse (Opus voice at ~24kbps is well under this;
  // OpenAI itself rejects >25MB). Reject non-audio content types too.
  const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
  if (audio.size > MAX_AUDIO_BYTES) return fail(c, 413, "Audio too large (max 5MB)");
  if (audio.type && !audio.type.startsWith("audio/")) return fail(c, 415, "Unsupported audio type");

  const user = await clerk(c.env).users.getUser(userId);
  const timezone = readTimezone(user);
  if (!timezone) return fail(c, 400, "No timezone set");

  const transcript = await transcribe(c.env, audio);
  const ai = await generateTasks(c.env, transcript, timezone);

  if (ai.type !== "create" || !ai.tasks) {
    return c.json({ response: ai.response, tasks: [] });
  }

  const tasks: Task[] = [];
  for (const t of ai.tasks) {
    const date = formatToUTC(t.date, timezone);
    if (date === null) return fail(c, 502, "AI returned an invalid date");
    const alert = t.alert === undefined ? undefined : formatToUTC(t.alert, timezone);
    if (t.alert !== undefined && alert === null) {
      return fail(c, 502, "AI returned an invalid alert");
    }

    const task: Task = {
      id: nanoid(6),
      title: t.title,
      date,
      alert: alert ?? undefined,
      duration: t.duration ?? "",
      priority: t.priority ?? 0,
      repeat: normalizeRepeat(t.repeat),
      tags: t.tags,
      completed: [],
    };

    const err = await enforceCreate(c.env, userId, task);
    if (err) return fail(c, 429, err);

    await insertTask(c.env.DB, userId, task);
    tasks.push(task);
  }

  return c.json({ response: ai.response, tasks });
});

export default voice;
