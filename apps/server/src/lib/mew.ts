import { DateTime } from "luxon";
import { nanoid } from "nanoid";
import {
  isCalendarEventLink,
  type MewAction,
  type MewBlock,
  type MewIntent,
  type MewReply,
  type MewRequest,
  type ProviderId,
  type Task,
} from "@dailify/shared";
import type { Env } from "../index";
import {
  DATE_ONLY_RE,
  PERSONA,
  clock,
  draftToTask,
  isGPTTask,
  isRecord,
  openaiClient,
  readOutput,
  taskRules,
  taskSchema,
  toDraft,
  toEpoch,
  type GPTTask,
} from "./openai";

export const WINDOW_DAYS = 14;
// ponytail: fixed window + cap. Add a search_tasks tool when people ask outside it.
const AGENDA_MAX = 300;

const INTENTS: readonly MewIntent[] = ["answer", "propose", "notFound", "unsupported"];
const ACTIONS: readonly MewAction[] = ["create", "move", "steps", "event", "delete"];

interface GPTProposal {
  action: MewAction;
  ids: string[];
  date: string | null;
  tasks: GPTTask[];
}

interface GPTMew {
  intent: MewIntent;
  reply: string;
  show: string[];
  proposals: GPTProposal[];
}

const isStrings = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");

const isProposal = (v: unknown): v is GPTProposal =>
  isRecord(v) &&
  ACTIONS.some((a) => a === v.action) &&
  isStrings(v.ids) &&
  (v.date === null || typeof v.date === "string") &&
  Array.isArray(v.tasks) &&
  v.tasks.every(isGPTTask);

// Untrusted: parsed straight out of the model's JSON output.
const isGPTMew = (v: unknown): v is GPTMew =>
  isRecord(v) &&
  INTENTS.some((i) => i === v.intent) &&
  typeof v.reply === "string" &&
  isStrings(v.show) &&
  Array.isArray(v.proposals) &&
  v.proposals.every(isProposal);

const schema = (allowed: readonly ProviderId[]) => ({
  type: "object",
  additionalProperties: false,
  required: ["intent", "reply", "show", "proposals"],
  properties: {
    intent: { type: "string", enum: INTENTS },
    reply: { type: "string" },
    show: { type: "array", items: { type: "string" } },
    proposals: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["action", "ids", "date", "tasks"],
        properties: {
          action: { type: "string", enum: ACTIONS },
          ids: { type: "array", items: { type: "string" } },
          date: { type: ["string", "null"] },
          tasks: { type: "array", items: taskSchema(allowed) },
        },
      },
    },
  },
});

const isDone = (t: Task) => t.completed.includes(t.date);
const isRecurring = (t: Task) => t.repeat !== "Off";
const isLinked = (t: Task) => t.links?.some(isCalendarEventLink) ?? false;

/**
 * What the model may see and reference, by ref: undated, open tasks from the last
 * `WINDOW_DAYS`, everything in the next `WINDOW_DAYS`. A series instance is `id@day`.
 */
export function agendaOf(tasks: Task[], timezone: string, now: number): Map<string, Task> {
  const today = DateTime.fromMillis(now, { zone: timezone }).startOf("day");
  const from = today.minus({ days: WINDOW_DAYS }).toMillis();
  const to = today.plus({ days: WINDOW_DAYS + 1 }).toMillis();
  const keep = (t: Task) =>
    t.undated || (t.date >= from && t.date < to && (t.date >= today.toMillis() || !isDone(t)));
  const refOf = (t: Task) =>
    isRecurring(t) && !t.undated
      ? `${t.id}@${DateTime.fromMillis(t.date, { zone: timezone }).toISODate()}`
      : t.id;
  const sorted = tasks.filter(keep).sort((a, b) => a.date - b.date);
  return new Map(sorted.slice(0, AGENDA_MAX).map((t) => [refOf(t), t]));
}

function lines(agenda: Map<string, Task>, timezone: string): string {
  if (!agenda.size) return "(vazia)";
  return [...agenda]
    .map(([ref, t]) =>
      [
        ref,
        t.title.replace(/[|\n\r]/g, " "),
        t.undated
          ? "sem data"
          : DateTime.fromMillis(t.date, { zone: timezone }).toFormat("yyyy-MM-dd'T'HH:mm"),
        isDone(t) ? "feita" : "aberta",
        isRecurring(t) ? "recorrente" : "-",
        isLinked(t) ? "google" : "-",
      ].join("|"),
    )
    .join("\n");
}

const PROMPT = (agenda: string, timezone: string, allowed: readonly ProviderId[]) => `
${PERSONA}

${clock(timezone)}

Você conversa sobre a agenda do usuário e propõe mudanças. Nada muda sem ele confirmar no app:
nunca diga que já fez, diga o que está propondo.

Agenda, uma tarefa por linha: ref|título|quando (hora local)|status|recorrente|no Google Agenda.
Vai de ${WINDOW_DAYS} dias atrás (só as em aberto) a ${WINDOW_DAYS} dias pra frente, mais as sem data.
${agenda}

"intent":
- "answer": responde sobre a agenda ("o que tenho amanhã?", "o que está atrasado?").
- "propose": propõe criar, mover, quebrar em passos, marcar evento ou apagar.
- "notFound": a pessoa citou uma tarefa que não está na agenda acima.
- "unsupported": qualquer outra coisa (concluir ou renomear tarefa você ainda não faz).
"show": as refs das tarefas que a resposta cita, pro app mostrar; [] se nenhuma. Só refs da agenda.
"proposals": [] fora de "propose". Cada uma:
- "action": "create" (tarefas novas), "move" (outra data), "steps" (quebrar uma tarefa em passos
  menores), "event" (compromisso pra pôr também no app conectado), "delete" (apagar).
- "ids": move/delete = refs das tarefas; steps = [ref da tarefa-mãe], ou [] se ela não está na
  agenda; create/event = [].
- "date": só no move. O novo dia "YYYY-MM-DD" (cada tarefa mantém a hora) ou
  "YYYY-MM-DDTHH:mm:ss" se a pessoa disse a hora; senão null.
- "tasks": só em create/steps/event, as tarefas novas; senão []. Cada item:
${taskRules(allowed)}
Tarefa recorrente nunca é movida nem apagada, e tarefa no Google Agenda nunca é apagada: diga isso
no "reply" se pedirem. Uma imagem anexada (print de convite, lista) vale como parte do pedido.

"reply": curto, sem markdown, na sua voz.
`;

/** Ids the model made up, series in move/delete and Google-linked tasks in delete never reach a block. */
export function toBlocks(
  out: GPTMew,
  agenda: Map<string, Task>,
  timezone: string,
  allowed: readonly ProviderId[],
  now: number,
): MewReply {
  const pick = (refs: string[]) => [...new Set(refs)].flatMap((r) => agenda.get(r) ?? []);
  const fresh = (p: GPTProposal, targets: readonly ProviderId[]) =>
    p.tasks.map((t) => toDraft(t, timezone, targets)).filter((d) => d.text);

  function confirm(p: GPTProposal): MewBlock | null {
    const base = { kind: "confirm" as const, id: nanoid(), action: p.action, before: [] };
    switch (p.action) {
      case "create":
      case "steps": {
        const after = fresh(p, []).map((d) => draftToTask(d, timezone, now));
        const parent = p.action === "steps" ? pick(p.ids)[0] : undefined;
        return after.length ? { ...base, after, ...(parent && { label: parent.title }) } : null;
      }
      case "event": {
        const drafts = fresh(p, allowed);
        const after = drafts.map((d) => draftToTask(d, timezone, now));
        if (!after.length) return null;
        // No connected app: it's just a create.
        if (!allowed.length) return { ...base, action: "create", after };
        const targets = allowed.map((provider) => ({
          provider,
          ...(drafts.some((d) => d.targets?.some((x) => x.provider === provider && x.meet)) && {
            meet: true,
          }),
        }));
        return { ...base, after, targets };
      }
      case "move": {
        if (p.date === null) return null;
        const at = toEpoch(p.date, timezone);
        if (at === null) throw new Error("AI returned an invalid date");
        const day = DateTime.fromMillis(at, { zone: timezone });
        const keepTime = DATE_ONLY_RE.test(p.date);
        // ponytail: undated tasks can't be moved yet; giving one a day needs a default hour.
        const before = pick(p.ids).filter((t) => !isRecurring(t) && !t.undated);
        const after = before.map((t) => {
          const from = DateTime.fromMillis(t.date, { zone: timezone });
          const date = keepTime
            ? day
                .set({ hour: from.hour, minute: from.minute, second: 0, millisecond: 0 })
                .toMillis()
            : at;
          return { ...t, date, ...(t.alert !== undefined && { alert: t.alert + date - t.date }) };
        });
        return before.length ? { ...base, before, after, label: day.toISODate() ?? "" } : null;
      }
      case "delete": {
        const before = pick(p.ids).filter((t) => !isRecurring(t) && !isLinked(t));
        return before.length ? { ...base, before, after: [] } : null;
      }
    }
  }

  const shown = pick(out.show);
  const proposals = out.intent === "propose" ? out.proposals.flatMap((p) => confirm(p) ?? []) : [];
  const blocks: MewBlock[] = [
    ...(shown.length ? [{ kind: "tasks" as const, tasks: shown }] : []),
    ...proposals,
  ];
  // Nothing survived the whitelist: she proposed about tasks she can't touch.
  const intent = out.intent === "propose" && !proposals.length ? "notFound" : out.intent;
  return { reply: out.reply.trim(), intent, blocks };
}

/** One model call. Throws on any failure or off-contract output: the caller answers 502, no debit. */
export async function askMew(
  env: Env,
  req: MewRequest,
  agenda: Map<string, Task>,
  allowed: readonly ProviderId[],
): Promise<MewReply> {
  const now = Date.now();
  const result = await openaiClient(env).responses.create(
    {
      model: "gpt-6-luna",
      reasoning: { effort: "low" },
      store: false,
      instructions: PROMPT(lines(agenda, req.timezone), req.timezone, allowed),
      input: [
        ...req.history.map((h) => ({
          role: h.from === "me" ? ("user" as const) : ("assistant" as const),
          content: h.text,
        })),
        {
          role: "user" as const,
          content: [
            { type: "input_text" as const, text: req.text },
            ...(req.image
              ? [{ type: "input_image" as const, image_url: req.image, detail: "auto" as const }]
              : []),
          ],
        },
      ],
      text: {
        format: { type: "json_schema", name: "mew_chat", strict: true, schema: schema(allowed) },
      },
    },
    { timeout: 30_000 },
  );
  return toBlocks(readOutput(result.output_text, isGPTMew), agenda, req.timezone, allowed, now);
}
