import { TZDate } from "@date-fns/tz";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { normalize, parseTaskText } from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";

// The simulated Mew of /preview/mew: pure, no network. Text in, a scripted event sequence out.

const t = copy.mewChat;

export interface AgendaTask {
  id: string;
  title: string;
  date: number;
  hasTime: boolean;
  done: boolean;
  calendar?: boolean;
}

/** `status` → `draft` → `done`, like the landing's MessageBox; `cancelled`/`undone` close it. */
export type Step = "status" | "draft" | "done" | "cancelled" | "undone";
export type Action = "create" | "move" | "steps" | "event" | "delete";

export type Block =
  | { kind: "tasks"; tasks: AgendaTask[] }
  | {
      kind: "confirm";
      id: string;
      action: Action;
      step: Step;
      /** Confirming swaps `before` out of the agenda and `after` (minus `off`) in; undo reverses. */
      before: AgendaTask[];
      after: AgendaTask[];
      off: string[];
      /** The parent task (steps) or the target day label (move), for the box title. */
      label?: string;
    };

export type ConfirmBlock = Extract<Block, { kind: "confirm" }>;

export type ChatEvent =
  | { type: "typing"; ms: number }
  | { type: "word"; word: string }
  | { type: "block"; block: Block }
  | { type: "settle"; id: string; ms: number };

export interface Context {
  tasks: AgendaTask[];
  now: TZDate;
  image?: boolean;
  nextId: () => string;
}

const TYPING_MS = 650;
const SETTLE_MS = 1400;

export const swap = (tasks: AgendaTask[], out: AgendaTask[], into: AgendaTask[]) => [
  ...tasks.filter((task) => !out.some((o) => o.id === task.id)),
  ...into,
];

export const isOverdue = (task: AgendaTask, now: TZDate) =>
  !task.done && task.date < startOfDay(now).getTime();

/** "hoje", "amanhã" or the weekday ("sexta-feira"), as the Mew says it. */
export function dayName(ms: number, now: TZDate): string {
  const day = new TZDate(ms, now.timeZone ?? "UTC");
  if (isSameDay(day, now)) return t.todayWord;
  if (isSameDay(day, addDays(now, 1))) return t.tomorrowWord;
  return format(day, "EEEE", { locale: ptBR });
}

export function seedAgenda(now: TZDate): AgendaTask[] {
  return t.samples.seed.map((s, i) => {
    const day = addDays(startOfDay(now), s.day);
    return {
      id: `seed-${i}`,
      title: s.title,
      date: s.hour === null ? day.getTime() : day.setHours(s.hour),
      hasTime: s.hour !== null,
      done: s.done,
    };
  });
}

const say = (text: string): ChatEvent[] => [
  { type: "typing", ms: TYPING_MS },
  ...text.split(" ").map((word): ChatEvent => ({ type: "word", word })),
];

export const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));

const QUOTED = /['"‘’“”]([^'"‘’“”]+)['"‘’“”]/;
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function draftOf(text: string, ctx: Context): AgendaTask {
  const parsed = parseTaskText(text, ctx.now);
  return {
    id: ctx.nextId(),
    title: capitalize(parsed.text.trim()),
    date: parsed.date?.getTime() ?? startOfDay(ctx.now).getTime(),
    hasTime: parsed.hasTime,
    done: false,
  };
}

const confirm = (
  ctx: Context,
  action: Action,
  before: AgendaTask[],
  after: AgendaTask[],
  label?: string,
  step: Step = "draft",
): ConfirmBlock => ({
  kind: "confirm",
  id: ctx.nextId(),
  action,
  step,
  before,
  after,
  off: [],
  label,
});

function query(n: string, ctx: Context): ChatEvent[] {
  const day = n.includes("amanha") ? addDays(ctx.now, 1) : ctx.now;
  const tasks = ctx.tasks
    .filter((task) => isSameDay(new TZDate(task.date, ctx.now.timeZone ?? "UTC"), day))
    .sort((a, b) => a.date - b.date);
  const name = dayName(day.getTime(), ctx.now);
  const line = !tasks.length
    ? t.reply.queryNone
    : tasks.length === 1
      ? t.reply.queryOne
      : t.reply.queryMany;
  return [
    ...say(fill(line, { n: tasks.length, day: name })),
    ...(tasks.length ? [{ type: "block", block: { kind: "tasks", tasks } } as const] : []),
  ];
}

function moveOverdue(n: string, ctx: Context): ChatEvent[] {
  const late = ctx.tasks.filter((task) => isOverdue(task, ctx.now));
  if (!late.length) return say(t.reply.noOverdue);
  const target = parseTaskText(n, ctx.now).date ?? addDays(startOfDay(ctx.now), 1);
  const moved = late.map((task) => {
    const from = new TZDate(task.date, ctx.now.timeZone ?? "UTC");
    const to = new TZDate(target.getTime(), ctx.now.timeZone ?? "UTC");
    to.setHours(from.getHours(), from.getMinutes(), 0, 0);
    return { ...task, date: to.getTime() };
  });
  const block = confirm(ctx, "move", late, moved, dayName(target.getTime(), ctx.now), "status");
  return [
    ...say(t.reply.overdue),
    { type: "block", block },
    { type: "settle", id: block.id, ms: SETTLE_MS },
  ];
}

function breakDown(text: string, n: string, ctx: Context): ChatEvent[] {
  const named =
    text.match(QUOTED)?.[1] ??
    text
      .replace(/^.*?\b(quebra|quebre|divide|divida)\b/i, "")
      .replace(/\bem (passos|partes|subtarefas)\b.*$/i, "");
  const subject = normalize(named.trim());
  const parent = ctx.tasks.find((task) => normalize(task.title).includes(subject));
  const title = parent?.title ?? capitalize(named.trim());
  const day = parent?.date ?? startOfDay(ctx.now).getTime();
  const steps = (n.includes("mudanc") ? t.samples.moveSteps : t.samples.genericSteps).map(
    (step): AgendaTask => ({
      id: ctx.nextId(),
      title: step,
      date: day,
      hasTime: false,
      done: false,
    }),
  );
  return [
    ...say(fill(t.reply.steps, { task: title })),
    { type: "block", block: confirm(ctx, "steps", [], steps, title) },
  ];
}

function scheduleEvent(text: string, ctx: Context): ChatEvent[] {
  const event = draftOf(text, ctx);
  event.title = capitalize(
    event.title
      .replace(
        /^(marca|marque|agenda|agende|cria|crie|coloca|coloque|p[oõ]e|bota)\s+(uma?\s+)?/i,
        "",
      )
      .replace(/\s+(na|no)\s+(google\s+)?agenda$/i, ""),
  );
  if (!event.hasTime) event.date = addDays(startOfDay(ctx.now), 1).setHours(9);
  event.hasTime = true;
  event.calendar = true;
  const block = confirm(ctx, "event", [], [event], undefined, "status");
  return [
    ...say(t.reply.event),
    { type: "block", block },
    { type: "settle", id: block.id, ms: SETTLE_MS },
  ];
}

function remove(text: string, n: string, ctx: Context): ChatEvent[] {
  const named =
    text.match(QUOTED)?.[1] ??
    n.replace(
      /^.*?\b(apaga|apague|exclui|exclua|remove|remova|deleta)\b\s*(a |o |as |os )?(tarefa )?/,
      "",
    );
  const subject = normalize(named.trim());
  const doneOnes = /\b(concluidas|feitas)\b/.test(n);
  const hits = ctx.tasks.filter((task) =>
    doneOnes ? task.done : subject.length > 2 && normalize(task.title).includes(subject),
  );
  if (!hits.length) return say(t.reply.notFound);
  return [...say(t.reply.remove), { type: "block", block: confirm(ctx, "delete", hits, []) }];
}

function capture(text: string, ctx: Context): ChatEvent[] | null {
  if (ctx.image) {
    const drafts = t.samples.photo.map((line) => draftOf(line, ctx));
    return [...say(t.reply.photo), { type: "block", block: confirm(ctx, "create", [], drafts) }];
  }
  const parts = text
    .split(/,|;|\n|\s+e\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const drafts = parts.map((part) => draftOf(part, ctx));
  // One part only counts as a task when it says when.
  if (drafts.length < 2 && !parseTaskText(text, ctx.now).date) return null;
  const line = drafts.length === 1 ? t.reply.foundOne : t.reply.found;
  return [
    ...say(fill(line, { n: drafts.length })),
    { type: "block", block: confirm(ctx, "create", [], drafts) },
  ];
}

/** Keyword routing, most specific first; anything unknown gets the friendly fallback. */
export function reply(text: string, ctx: Context): ChatEvent[] {
  const n = normalize(text);
  if (ctx.image) return capture(text, ctx) ?? say(t.reply.fallback);
  if (/\b(apaga|apague|exclui|exclua|remove|remova|deleta)\b/.test(n)) return remove(text, n, ctx);
  if (/atrasad/.test(n)) return moveOverdue(n, ctx);
  if (/\b(quebra|quebre|divide|divida|passos|subtarefas)\b/.test(n)) return breakDown(text, n, ctx);
  if (/\b(reuniao|evento)\b/.test(n) && /\b(agenda|marca|marque)\b/.test(n))
    return scheduleEvent(text, ctx);
  if (/\b(o que|que) (eu )?tenho\b|\bminha agenda\b|\bo que tem\b/.test(n)) return query(n, ctx);
  return capture(text, ctx) ?? say(t.reply.fallback);
}
