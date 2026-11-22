import { isApiErrorCode } from "@dailify/shared";
import type {
  AiParse,
  ApiErrorCode,
  MewActionStatus,
  MewReply,
  MewRequest,
  MewTranscript,
  OccurrenceEdit,
  Task,
  TaskInput,
  QuotaSnapshot,
  PaymentDetails,
  Invoice,
  UserSettings,
  IntegrationLink,
  IntegrationStatus,
  ProviderId,
  ReminderToken,
  SetPasswordBody,
} from "@dailify/shared";
import { apiURL } from "@/consts/conts";
import { authClient, authHeaders } from "@/lib/auth";
import { appTimeZone, zoned } from "./zone";

/**
 * Falha de rede e falha de servidor pedem reações diferentes — uma volta sozinha quando a conexão
 * voltar, a outra não —, então quem chama precisa conseguir separar as duas.
 */
export interface ApiError {
  message: string;
  offline: boolean;
  /** HTTP status quando o servidor respondeu: 429 (créditos esgotados) pede outra reação que 502. */
  status?: number;
  /** The body's `API_ERROR` code: branch on it, never on `message`. */
  code?: ApiErrorCode;
}

const OFFLINE: ApiError = { message: "Sem conexão com o servidor.", offline: true };

// Web: cookie da sessão (`credentials`). App nativo: o bearer de `authHeaders()`.
const authed = (init: RequestInit = {}): RequestInit => ({
  ...init,
  credentials: "include",
  headers: {
    // FormData sets its own multipart boundary; a JSON Content-Type would break the upload.
    ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...authHeaders(),
    ...(init.headers ?? {}),
  },
});

/** O servidor erra em `{ error: "..." }` (`lib/errors.ts`); qualquer outro corpo não tem recado. */
function serverMessage(body: unknown): string | undefined {
  if (body && typeof body === "object" && "error" in body) {
    const { error } = body;
    if (typeof error === "string") return error;
  }
  return undefined;
}

function serverCode(body: unknown): ApiErrorCode | undefined {
  const code = body && typeof body === "object" ? Reflect.get(body, "code") : undefined;
  return isApiErrorCode(code) ? code : undefined;
}

/**
 * Todo acesso à API passa por aqui. O `fetch` cru de antes devolvia `[]` num erro de carga (a tela
 * dizia "nada agendado" pra quem só estava sem rede), aceitava um 500 no delete como sucesso, e
 * estourava em `res.json()` quando o corpo não era JSON — um 502 do Worker vem em HTML.
 */
async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ data?: T; error?: ApiError; errorBody?: Partial<T> }> {
  let res: Response;
  try {
    res = await fetch(`${apiURL}${path}`, authed(init));
  } catch {
    // `fetch` só rejeita por rede/CORS — status de erro chega como resposta normal.
    return { error: OFFLINE };
  }

  const body = await res.json().catch(() => undefined);

  if (!res.ok) {
    // Sessão morta no servidor: o gate relê o get-session e decide; a escrita segue na fila.
    if (res.status === 401) authClient.$store.notify("$sessionSignal");
    return {
      error: {
        message: serverMessage(body) ?? `O servidor falhou (${res.status}).`,
        offline: false,
        status: res.status,
        code: serverCode(body),
      },
      // Erro com dados (o 409 `already_linked` traz o vínculo e a tarefa): quem precisa, lê.
      errorBody: body,
    };
  }

  return { data: body };
}

// ponytail: also hand-formatted in the server's db/usage.ts; move to shared dates.ts when touched.
const monthKey = (month: Date) =>
  `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;

export async function getTasksForMonth(month: Date): Promise<{ tasks: Task[]; error?: ApiError }> {
  const m = monthKey(month);
  // O fuso vai junto: o Worker roda em UTC e sem isto a expansão da recorrência e a janela do mês
  // saem na hora errada para quem não está em Greenwich.
  const tz = encodeURIComponent(appTimeZone());
  const { data, error } = await request<{ tasks?: Task[] }>(`/tasks?month=${m}&tz=${tz}`);
  return { tasks: data?.tasks ?? [], error };
}

export async function getUndatedTasks(): Promise<{ tasks: Task[]; error?: ApiError }> {
  const { data, error } = await request<{ tasks?: Task[] }>("/tasks/undated");
  return { tasks: data?.tasks ?? [], error };
}

export async function getSettings(): Promise<{ settings?: UserSettings; error?: ApiError }> {
  const { data, error } = await request<UserSettings>("/settings");
  return { settings: data, error };
}

/** Parcial: manda só o que mudou, o servidor mantém o resto. */
export async function saveSettings(
  patch: Partial<UserSettings>,
): Promise<{ settings?: UserSettings; error?: ApiError }> {
  const { data, error } = await request<UserSettings>("/settings", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
  return { settings: data, error };
}

export async function createTask(input: TaskInput): Promise<{ task?: Task; error?: ApiError }> {
  const { data, error } = await request<{ task?: Task }>("/tasks", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return { task: data?.task, error };
}

/**
 * `occurrence` (epoch-ms da instância) = "editar só esta": o servidor destaca aquele dia da série
 * numa tarefa própria e devolve as duas — a nova em `task`, a série atualizada em `series`.
 */
export async function updateTask(
  id: string,
  /** `alert: null` limpa o lembrete. */
  patch: Partial<Omit<TaskInput, "alert">> & { alert?: number | null },
  /** Epoch-ms da ocorrência quando a edição vale só pra ela (o servidor destaca da série). */
  occurrence?: number,
): Promise<{ task?: Task; series?: Task; error?: ApiError }> {
  const query = occurrence === undefined ? "" : `?occurrence=${occurrence}`;
  const { data, error } = await request<OccurrenceEdit>(
    `/tasks/${encodeURIComponent(id)}${query}`,
    {
      method: "PATCH",
      body: JSON.stringify(patch),
    },
  );
  return { task: data?.task, series: data?.series, error };
}

export async function completeTask(
  id: string,
  at: number = Date.now(),
): Promise<{ task?: Task; error?: ApiError }> {
  // `at` vai no corpo: uma conclusão feita offline aconteceu na hora do toque, não na hora em que
  // a fila conseguiu subir.
  const { data, error } = await request<{ task?: Task }>(
    `/tasks/${encodeURIComponent(id)}/complete`,
    {
      method: "POST",
      body: JSON.stringify({ at }),
    },
  );
  return { task: data?.task, error };
}

/**
 * Desfaz a conclusão do dia. O intervalo sai daqui (não do servidor) porque o dia é local do
 * usuário e o Worker roda em UTC.
 */
export async function uncompleteTask(
  id: string,
  day: Date,
): Promise<{ task?: Task; error?: ApiError }> {
  return uncompleteTaskRange(
    id,
    zoned(day).setHours(0, 0, 0, 0),
    zoned(day).setHours(23, 59, 59, 999),
  );
}

export async function uncompleteTaskRange(
  id: string,
  from: number,
  to: number,
): Promise<{ task?: Task; error?: ApiError }> {
  const { data, error } = await request<{ task?: Task }>(
    `/tasks/${encodeURIComponent(id)}/complete?from=${from}&to=${to}`,
    { method: "DELETE" },
  );
  return { task: data?.task, error };
}

export async function deleteTask(
  id: string,
  /** Epoch-ms da ocorrência quando a exclusão vale só pra ela: sai da série via `exdates`, e a
   *  série volta em `series` para o cliente reexpandir o mês sem aquele dia. */
  occurrence?: number,
  /** When the delete was made: a queued one loses to an edit the server stored after it. */
  updatedAt?: number,
): Promise<{ series?: Task; error?: ApiError }> {
  const params = new URLSearchParams();
  if (occurrence !== undefined) params.set("occurrence", String(occurrence));
  if (updatedAt !== undefined) params.set("updatedAt", String(updatedAt));
  const query = params.size ? `?${params}` : "";
  const { data, error } = await request<OccurrenceEdit>(
    `/tasks/${encodeURIComponent(id)}${query}`,
    {
      method: "DELETE",
    },
  );
  return { series: data?.series, error };
}

/** Só lê: devolve rascunhos, quem cria é o composer depois de confirmar. Debita 1 crédito de IA. */
export async function parseTaskAi(text: string): Promise<{ result?: AiParse; error?: ApiError }> {
  const { data, error } = await request<AiParse>("/tasks/parse", {
    method: "POST",
    body: JSON.stringify({ text, timezone: appTimeZone() }),
  });
  return { result: data, error };
}

/** 403 = no consent yet, 429 = out of AI credits, 413 = image too big, 502 = model failed (no debit). */
export async function mewChat(req: MewRequest): Promise<{ reply?: MewReply; error?: ApiError }> {
  const { data, error } = await request<MewReply>("/mew/chat", {
    method: "POST",
    body: JSON.stringify(req),
  });
  return { reply: data, error };
}

/** The chat's mic: audio in, the text to send as the turn. Debits nothing; the turn does. */
export async function transcribeMew(form: FormData): Promise<{ text?: string; error?: ApiError }> {
  const { data, error } = await request<MewTranscript>("/mew/transcribe", {
    method: "POST",
    body: form,
  });
  return { text: data?.text, error };
}

/** Audit trail of a confirm box; fire and forget. */
export async function setMewAction(id: string, status: MewActionStatus): Promise<void> {
  await request(`/mew/actions/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

/** A confirmed send box; 404 = already sent or not yours, 409 `reconnect`, 502 = the app failed. */
export async function sendMewAction(id: string, text: string): Promise<{ error?: ApiError }> {
  const { error } = await request<never>(`/mew/actions/${encodeURIComponent(id)}/send`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
  return { error };
}

export async function createTaskVoice(
  formData: FormData,
): Promise<{ tasks: Task[]; response?: string; error?: ApiError }> {
  const { data, error } = await request<{ tasks?: Task[]; response?: string }>("/tasks/voice", {
    method: "POST",
    body: formData,
  });
  return { tasks: data?.tasks ?? [], response: data?.response, error };
}

export async function getPushKey(): Promise<string | null> {
  const { data } = await request<{ key?: string }>("/push/key");
  return data?.key ?? null;
}

export async function savePushSubscription(subscription: {
  endpoint: string;
  p256dh: string;
  auth: string;
  timezone: string;
}): Promise<boolean> {
  const { error } = await request("/push/subscription", {
    method: "POST",
    body: JSON.stringify(subscription),
  });
  return !error;
}

/** A read-only token for the Android app's background reminder sync. */
export async function createReminderToken(): Promise<string | null> {
  const { data } = await request<ReminderToken>("/reminders/token", { method: "POST" });
  return data?.token ?? null;
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  await request("/push/subscription", { method: "DELETE", body: JSON.stringify({ endpoint }) });
}

// dailifyContext imports it from here.
export type { QuotaSnapshot };

export async function getQuotas(): Promise<{ quotas?: QuotaSnapshot; error?: ApiError }> {
  const { data, error } = await request<QuotaSnapshot>("/permissions");
  return { quotas: data, error };
}

/** `paymentDetails: null` = no subscription; on `error` it is absent, so keep what was shown. */
export async function getPaymentDetails(): Promise<{
  paymentDetails?: PaymentDetails | null;
  error?: ApiError;
}> {
  const { data, error } = await request<PaymentDetails>("/billing/payment-details");
  return error ? { error } : { paymentDetails: data ?? null };
}

export async function getInvoices(): Promise<{ invoices?: Invoice[]; error?: ApiError }> {
  const { data, error } = await request<Invoice[]>("/billing/invoices");
  return error ? { error } : { invoices: data ?? [] };
}

export async function checkout(
  productName: string,
): Promise<{ url: string | null; error?: ApiError }> {
  const { data, error } = await request<{ url: string | null }>("/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ productName }),
  });
  return { url: data?.url ?? null, error };
}

export async function billingPortal(): Promise<{ url: string | null; error?: ApiError }> {
  const { data, error } = await request<{ url: string | null }>("/billing/portal");
  return { url: data?.url ?? null, error };
}

export async function getIntegrations(): Promise<{
  integrations?: IntegrationStatus[];
  error?: ApiError;
}> {
  const { data, error } = await request<IntegrationStatus[]>("/integrations");
  return { integrations: data, error };
}

/** Devolve a URL de consentimento do provedor; 403 = plano não inclui, 503 = não configurada. */
export async function connectIntegration(
  provider: ProviderId,
): Promise<{ url?: string; error?: ApiError }> {
  const { data, error } = await request<{ url?: string }>(`/integrations/${provider}/connect`, {
    method: "POST",
  });
  return { url: data?.url, error };
}

/** A first password for a link/Google account; 403 `mfa_required` asks for a step-up. */
export async function setPassword(newPassword: string): Promise<{ error?: ApiError }> {
  const { error } = await request<never>("/security/password", {
    method: "POST",
    body: JSON.stringify({ newPassword } satisfies SetPasswordBody),
  });
  return { error };
}

/** O `state` é de uso único no servidor: um segundo POST com ele volta 400. */
export async function completeIntegration(
  provider: ProviderId,
  code: string,
  state: string,
): Promise<{ integration?: IntegrationStatus & { imported?: number }; error?: ApiError }> {
  // `imported`: quantos eventos da Agenda viraram tarefa no sync inicial.
  const { data, error } = await request<IntegrationStatus & { imported?: number }>(
    `/integrations/${provider}/callback`,
    { method: "POST", body: JSON.stringify({ code, state }) },
  );
  return { integration: data, error };
}

export async function disconnectIntegration(provider: ProviderId): Promise<{ error?: ApiError }> {
  const { error } = await request<never>(`/integrations/${provider}`, { method: "DELETE" });
  return { error };
}

/** Switches off "A Mew lê sem perguntar": she asks again next time. */
export async function revokeReadGrant(provider: ProviderId): Promise<{ error?: ApiError }> {
  const { error } = await request<never>(`/integrations/${provider}/grants/read`, {
    method: "DELETE",
  });
  return { error };
}

/** 409 com `code`: `reconnect` (sem conexão ativa) ou `already_linked`. */
export async function createCalendarEvent(
  taskId: string,
  meet: boolean,
): Promise<{ link?: IntegrationLink; task?: Task; error?: ApiError }> {
  const { data, error, errorBody } = await request<{ link: IntegrationLink; task: Task }>(
    "/integrations/google-calendar/events",
    { method: "POST", body: JSON.stringify({ taskId, timezone: appTimeZone(), meet }) },
  );
  const body = data ?? errorBody;
  return { link: body?.link, task: body?.task, error };
}

/** Reenvia uma tarefa `stale` ao Google agora; devolve a tarefa como ficou (null = apagada). */
export async function syncCalendarEvent(
  taskId: string,
): Promise<{ task?: Task | null; error?: ApiError }> {
  const { data, error } = await request<{ task: Task | null }>(
    `/integrations/google-calendar/events/${encodeURIComponent(taskId)}/sync`,
    { method: "POST", body: JSON.stringify({ timezone: appTimeZone() }) },
  );
  return { task: data?.task, error };
}

/** "Gerar novo Meet": o evento ganha uma sala nova e a tarefa volta com o link dela no lugar do antigo. */
export async function replaceCalendarMeet(
  taskId: string,
): Promise<{ task?: Task; error?: ApiError }> {
  const { data, error } = await request<{ task: Task }>(
    `/integrations/google-calendar/events/${encodeURIComponent(taskId)}/meet`,
    { method: "POST" },
  );
  return { task: data?.task, error };
}

/** Duplicata da importação: "merge" junta na tarefa própria (a importada some), "keep" mantém as duas. */
export async function resolveDuplicate(
  importedId: string,
  action: "merge" | "keep",
): Promise<{ task?: Task; removedId?: string; error?: ApiError }> {
  const { data, error } = await request<{ task?: Task; removedId?: string }>(
    `/integrations/google-calendar/duplicates/${encodeURIComponent(importedId)}`,
    { method: "POST", body: JSON.stringify({ action }) },
  );
  return { task: data?.task, removedId: data?.removedId, error };
}
