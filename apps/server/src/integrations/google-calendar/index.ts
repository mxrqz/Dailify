import { IANAZone } from "luxon";
import {
  calendarEventPreview,
  INTEGRATION_ERROR,
  TASK_LIMITS,
  type IntegrationLink,
  type Task,
} from "@dailify/shared";
import { getLink, upsertLink } from "../../db/integrations";
import { getTask, updateTask } from "../../db/tasks";
import { ActionError, type Action, type Ctx, type Provider } from "../types";
import { toEvent, type GoogleEvent } from "./event";

const EVENTS_API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const NO_DAY = "Tarefa sem dia não vira evento: escolha um dia antes";

// Só eventos de agendas que a pessoa é dona: sensível, mas sem auditoria CASA (zpq).
const EVENTS = "https://www.googleapis.com/auth/calendar.events.owned";

export interface CreateEventInput {
  taskId: string;
  timeZone: string;
  meet: boolean;
}

async function ownTask(ctx: Ctx, id: string): Promise<Task> {
  const task = await getTask(ctx.env.DB, ctx.userId, id);
  if (!task) throw new ActionError(404, "Tarefa não encontrada");
  return task;
}

const text = (body: unknown, key: string): string | undefined => {
  const v = typeof body === "object" && body !== null ? Reflect.get(body, key) : undefined;
  return typeof v === "string" ? v : undefined;
};

/** Insert; 409 = o id já existe (retry depois de o D1 falhar, ou evento apagado que volta). */
async function saveEvent(ctx: Ctx, event: GoogleEvent, meet: boolean) {
  const query = meet ? "?conferenceDataVersion=1" : "";
  const init = (method: string, body: object): RequestInit => ({
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  let res = await ctx.api(`${EVENTS_API}${query}`, init("POST", event));
  // PATCH com status confirmado: recupera o que existe e revive o que foi pra lixeira.
  if (res.status === 409)
    res = await ctx.api(
      `${EVENTS_API}/${event.id}${query}`,
      init("PATCH", { ...event, status: "confirmed" }),
    );
  if (!res.ok) {
    console.error(`Google Agenda ${res.status}`, await res.text().catch(() => ""));
    throw new ActionError(
      502,
      res.status === 403 || res.status === 429
        ? "O Google Agenda está limitando os pedidos; tente de novo em alguns minutos"
        : "O Google Agenda não respondeu; tente de novo",
    );
  }
  const body: unknown = await res.json();
  const htmlLink = text(body, "htmlLink");
  if (!htmlLink) throw new ActionError(502, "O Google Agenda não respondeu; tente de novo");
  return { htmlLink, hangoutLink: text(body, "hangoutLink") };
}

export const createEvent: Action<CreateEventInput> = {
  name: "create-event",
  kind: "write",
  parse(raw) {
    const field = (k: string) =>
      typeof raw === "object" && raw !== null ? Reflect.get(raw, k) : undefined;
    const taskId = field("taskId");
    const timeZone = field("timezone");
    const meet = field("meet");
    if (typeof taskId !== "string" || !taskId) return { error: "taskId é obrigatório" };
    if (typeof timeZone !== "string" || !IANAZone.isValidZone(timeZone))
      return { error: "Fuso inválido" };
    if (meet !== undefined && typeof meet !== "boolean") return { error: "meet inválido" };
    return { input: { taskId, timeZone, meet: meet === true } };
  },
  async preview(ctx, input) {
    const task = await ownTask(ctx, input.taskId);
    const preview = calendarEventPreview(task, input.timeZone, {
      meet: input.meet,
      now: Date.now(),
    });
    if (!preview) throw new ActionError(400, NO_DAY);
    return preview;
  },
  async run(ctx, input): Promise<{ link: IntegrationLink; task: Task }> {
    const task = await ownTask(ctx, input.taskId);
    const existing = await getLink(ctx.env.DB, ctx.userId, "google-calendar", task.id);
    if (existing)
      throw new ActionError(409, "Esta tarefa já está no Google Agenda", {
        code: INTEGRATION_ERROR.alreadyLinked,
        link: existing,
      });
    const event = toEvent(task, input.timeZone, { meet: input.meet });
    if (!event) throw new ActionError(400, NO_DAY);

    const saved = await saveEvent(ctx, event, input.meet);
    const link: IntegrationLink = {
      provider: "google-calendar",
      taskId: task.id,
      externalId: event.id,
      url: saved.htmlLink,
    };
    await upsertLink(ctx.env.DB, ctx.userId, link, Date.now());

    // Os links novos entram no fim e, se passar do teto, quem sai são os mais antigos do fim.
    const added = [saved.htmlLink, saved.hangoutLink].filter((l): l is string => !!l);
    const kept = (task.links ?? []).filter((l) => !added.includes(l));
    const links = [...kept.slice(0, TASK_LIMITS.linksMax - added.length), ...added];
    const updated = await updateTask(ctx.env.DB, ctx.userId, task.id, { links });
    return { link, task: updated ?? task };
  },
};

export const googleCalendar: Provider = {
  id: "google-calendar",
  oauth: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    revokeUrl: "https://oauth2.googleapis.com/revoke",
    credentials: (env) => ({ id: env.GOOGLE_CLIENT_ID, secret: env.GOOGLE_CLIENT_SECRET }),
    scopes: ["openid", "email", EVENTS],
    required: [EVENTS],
    // offline + consent: sem eles o Google não devolve refresh_token na reconexão.
    extraParams: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
  },
  // userinfo em vez de decodificar o id_token: mesmo caminho de qualquer provider (GitHub/Notion
  // não têm id_token) e nenhum JWT pra validar.
  async identify(ctx) {
    const res = await ctx.api("https://openidconnect.googleapis.com/v1/userinfo");
    if (!res.ok) throw new Error(`userinfo ${res.status}`);
    const body: unknown = await res.json();
    const sub = typeof body === "object" && body !== null ? Reflect.get(body, "sub") : undefined;
    const email = typeof body === "object" && body !== null ? Reflect.get(body, "email") : null;
    if (typeof sub !== "string") throw new Error("userinfo sem sub");
    return { accountId: sub, email: typeof email === "string" ? email : null };
  },
  actions: [createEvent],
};
