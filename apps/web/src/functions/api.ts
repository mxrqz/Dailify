import type {
  AiParse,
  Task,
  TaskInput,
  QuotaLimits,
  QuotaUsage,
  PaymentDetails,
  Invoice,
  WeekStart,
} from "@dailify/shared";
import { apiURL } from "@/consts/conts";
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
}

const OFFLINE: ApiError = { message: "Sem conexão com o servidor.", offline: true };

const authed = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
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

/**
 * Todo acesso à API passa por aqui. O `fetch` cru de antes devolvia `[]` num erro de carga (a tela
 * dizia "nada agendado" pra quem só estava sem rede), aceitava um 500 no delete como sucesso, e
 * estourava em `res.json()` quando o corpo não era JSON — um 502 do Worker vem em HTML.
 */
async function request<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<{ data?: T; error?: ApiError }> {
  let res: Response;
  try {
    res = await fetch(`${apiURL}${path}`, authed(token, init));
  } catch {
    // `fetch` só rejeita por rede/CORS — status de erro chega como resposta normal.
    return { error: OFFLINE };
  }

  const body = await res.json().catch(() => undefined);

  if (!res.ok) {
    return {
      error: {
        message: serverMessage(body) ?? `O servidor falhou (${res.status}).`,
        offline: false,
        status: res.status,
      },
    };
  }

  return { data: body };
}

export async function getTasksForMonth(
  token: string,
  month: Date,
): Promise<{ tasks: Task[]; error?: ApiError }> {
  const m = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  // O fuso vai junto: o Worker roda em UTC e sem isto a expansão da recorrência e a janela do mês
  // saem na hora errada para quem não está em Greenwich.
  const tz = encodeURIComponent(appTimeZone());
  const { data, error } = await request<{ tasks?: Task[] }>(`/tasks?month=${m}&tz=${tz}`, token);
  return { tasks: data?.tasks ?? [], error };
}

export async function getUndatedTasks(token: string): Promise<{ tasks: Task[]; error?: ApiError }> {
  const { data, error } = await request<{ tasks?: Task[] }>("/tasks/undated", token);
  return { tasks: data?.tasks ?? [], error };
}

export interface Settings {
  weekStart: WeekStart;
  /** null = automático: o fuso do aparelho. */
  timeZone: string | null;
  hour12: boolean;
}

export async function getSettings(
  token: string,
): Promise<{ settings?: Settings; error?: ApiError }> {
  const { data, error } = await request<Settings>("/settings", token);
  return { settings: data, error };
}

/** Parcial: manda só o que mudou, o servidor mantém o resto. */
export async function saveSettings(
  token: string,
  patch: Partial<Settings>,
): Promise<{ settings?: Settings; error?: ApiError }> {
  const { data, error } = await request<Settings>("/settings", token, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
  return { settings: data, error };
}

export async function createTask(
  token: string,
  input: TaskInput,
): Promise<{ task?: Task; error?: ApiError }> {
  const { data, error } = await request<{ task?: Task; error?: string }>("/tasks", token, {
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
  token: string,
  id: string,
  /** `alert: null` limpa o lembrete. */
  patch: Partial<Omit<TaskInput, "alert">> & { alert?: number | null },
  /** Epoch-ms da ocorrência quando a edição vale só pra ela (o servidor destaca da série). */
  occurrence?: number,
): Promise<{ task?: Task; series?: Task; error?: ApiError }> {
  const query = occurrence === undefined ? "" : `?occurrence=${occurrence}`;
  const { data, error } = await request<{ task?: Task; series?: Task }>(
    `/tasks/${id}${query}`,
    token,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
  return { task: data?.task, series: data?.series, error };
}

export async function completeTask(
  token: string,
  id: string,
  at: number = Date.now(),
): Promise<{ task?: Task; error?: ApiError }> {
  // `at` vai no corpo: uma conclusão feita offline aconteceu na hora do toque, não na hora em que
  // a fila conseguiu subir.
  const { data, error } = await request<{ task?: Task }>(`/tasks/${id}/complete`, token, {
    method: "POST",
    body: JSON.stringify({ at }),
  });
  return { task: data?.task, error };
}

/**
 * Desfaz a conclusão do dia. O intervalo sai daqui (não do servidor) porque o dia é local do
 * usuário e o Worker roda em UTC.
 */
export async function uncompleteTask(
  token: string,
  id: string,
  day: Date,
): Promise<{ task?: Task; error?: ApiError }> {
  return uncompleteTaskRange(
    token,
    id,
    zoned(day).setHours(0, 0, 0, 0),
    zoned(day).setHours(23, 59, 59, 999),
  );
}

export async function uncompleteTaskRange(
  token: string,
  id: string,
  from: number,
  to: number,
): Promise<{ task?: Task; error?: ApiError }> {
  const { data, error } = await request<{ task?: Task }>(
    `/tasks/${id}/complete?from=${from}&to=${to}`,
    token,
    { method: "DELETE" },
  );
  return { task: data?.task, error };
}

export async function deleteTask(
  token: string,
  id: string,
  /** Epoch-ms da ocorrência quando a exclusão vale só pra ela: sai da série via `exdates`, e a
   *  série volta em `series` para o cliente reexpandir o mês sem aquele dia. */
  occurrence?: number,
): Promise<{ series?: Task; error?: ApiError }> {
  const query = occurrence === undefined ? "" : `?occurrence=${occurrence}`;
  const { data, error } = await request<{ series?: Task }>(`/tasks/${id}${query}`, token, {
    method: "DELETE",
  });
  return { series: data?.series, error };
}

/** Só lê: devolve rascunhos, quem cria é o composer depois de confirmar. Debita 1 crédito de IA. */
export async function parseTaskAi(
  token: string,
  text: string,
): Promise<{ result?: AiParse; error?: ApiError }> {
  const { data, error } = await request<AiParse>("/tasks/parse", token, {
    method: "POST",
    body: JSON.stringify({ text, timezone: appTimeZone() }),
  });
  return { result: data, error };
}

/** Sem `request`: o corpo é FormData, e o Content-Type JSON dele quebraria o upload. */
export async function createTaskVoice(
  token: string,
  formData: FormData,
): Promise<{ tasks: Task[]; response?: string; error?: ApiError }> {
  let res: Response;
  try {
    res = await fetch(`${apiURL}/tasks/voice`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
  } catch {
    return { tasks: [], error: OFFLINE };
  }
  const body = await res.json().catch(() => undefined);
  if (!res.ok) {
    const message = serverMessage(body) ?? `O servidor falhou (${res.status}).`;
    return { tasks: [], error: { message, offline: false } };
  }
  return { tasks: body?.tasks ?? [], response: body?.response };
}

export async function getPushKey(): Promise<string | null> {
  const res = await fetch(`${apiURL}/push/key`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.key ?? null;
}

export async function savePushSubscription(
  token: string,
  subscription: { endpoint: string; p256dh: string; auth: string; timezone: string },
): Promise<boolean> {
  const res = await fetch(
    `${apiURL}/push/subscription`,
    authed(token, { method: "POST", body: JSON.stringify(subscription) }),
  );
  return res.ok;
}

export async function removePushSubscription(token: string, endpoint: string): Promise<void> {
  await fetch(
    `${apiURL}/push/subscription`,
    authed(token, { method: "DELETE", body: JSON.stringify({ endpoint }) }),
  );
}

export interface QuotaSnapshot {
  limits: QuotaLimits;
  usage: QuotaUsage;
}

export async function getQuotas(token: string, month: Date): Promise<QuotaSnapshot | undefined> {
  const m = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
  const { data } = await request<QuotaSnapshot>(`/permissions?month=${m}`, token);
  return data;
}

export async function getPaymentDetails(token: string): Promise<PaymentDetails | null> {
  const { data } = await request<PaymentDetails>("/billing/payment-details", token);
  return data ?? null;
}

export async function getInvoices(token: string): Promise<Invoice[]> {
  const { data } = await request<Invoice[]>("/billing/invoices", token);
  return data ?? [];
}

export async function checkout(
  token: string,
  productName: string,
): Promise<{ url: string | null }> {
  const { data } = await request<{ url: string | null }>("/billing/checkout", token, {
    method: "POST",
    body: JSON.stringify({ productName }),
  });
  return { url: data?.url ?? null };
}

export async function billingPortal(token: string): Promise<{ url: string | null }> {
  const { data } = await request<{ url: string | null }>("/billing/portal", token);
  return { url: data?.url ?? null };
}
