import type { CalendarTarget } from "./integrations";
import type { PlanRole } from "./pricing";

export type Repeat = "Off" | "Daily" | "Monthly" | "Yearly" | { Weekly: string[] };

export interface Task {
  id: string;
  title: string;
  date: number; // epoch ms
  alert?: number; // epoch ms
  duration: string; // "10m", "1h30m"
  priority: number; // 0-4
  repeat: Repeat;
  /** A cada N períodos do `repeat` (inteiro 2..365), com a fase na `date`; ausente = 1. */
  repeatEvery?: number;
  /** Fim da série (UNTIL do Google): a expansão para depois desta data. Só o servidor escreve. */
  repeatUntil?: number; // epoch ms
  tags?: string[];
  links?: string[]; // URLs absolutas http(s), validadas na rota
  completed: number[]; // epoch ms
  /** Epoch-ms da última escrita. É o que decide o conflito no servidor (LWW). */
  updatedAt?: number;
  /** Hash do conteúdo (`taskHash`) — derivado, nunca guardado: quem lê recalcula. */
  hash?: string;
  /** Ocorrências da série que viraram tarefa própria: a expansão pula estas datas. Só o servidor escreve. */
  exdates?: number[]; // epoch ms
  /** `true` = Sem data (fora da agenda); ausente/`false` = tarefa de agenda. */
  undated?: boolean;
  /** Instância expandida: a `date` da série. Derivado na expansão, nunca gravado. */
  seriesStart?: number;
}

export type TaskInput = Omit<Task, "id" | "completed" | "hash" | "repeatEvery" | "repeatUntil"> & {
  id?: string;
  completed?: number[];
  /** `null` volta a 1 — `undefined` some no JSON, e o PATCH (e a fila offline) manteria o antigo. */
  repeatEvery?: number | null;
};

/** `PATCH`/`DELETE /tasks/:id?occurrence=`: the detached day in `task` (PATCH only), the series in `series`. */
export interface OccurrenceEdit {
  task?: Task;
  series?: Task;
}

/**
 * `GET /tasks/sync`: stored rows, series unexpanded. `full` = replace the local store with `tasks`;
 * otherwise upsert `tasks`, then drop `deleted`. `cursor` is opaque: send it back as `?since=`.
 */
export interface TaskSync {
  full: boolean;
  tasks: Task[];
  /** Ids deleted since the cursor; always empty on a full pull. */
  deleted: string[];
  cursor: string;
}

/** How far back a full pull reaches for one-off dated tasks (~6 months); older months come by month. */
export const SYNC_WINDOW_DAYS = 183;

/**
 * A task draft read from a sentence: `ParsedTask` (`parse-task/index.ts`) without `unsure`/`fields`,
 * dated in epoch-ms, so the AI reply fills the same composer chips.
 */
export interface ParsedTaskWire {
  text: string;
  date: number | null; // epoch ms
  /** Falso quando `date` só tem dia (hora ficou 00:00 por padrão) — quem consome decide o default. */
  hasTime: boolean;
  /** Dia explícito ("qui", "dia 5") ou recorrência semanal com dias citados ("toda quarta"). */
  hasDay: boolean;
  duration: string | null;
  links: string[];
  repeat: Repeat;
  repeatEvery?: number;
  /** Só da IA: o app conectado em que a pessoa pediu pra pôr a tarefa. Sugestão — o cliente confirma. */
  targets?: CalendarTarget[];
}

export type AiIntent = "create" | "question" | "command" | "unsupported";

/** `POST /tasks/parse`: só rascunhos — quem cria é o cliente, depois de confirmar. */
export interface AiParse {
  reply: string;
  intent: AiIntent;
  drafts: ParsedTaskWire[];
}

export type Role = "free" | "pro" | "max" | "admin";

export const PLAN_ID = { free: "free", pro: "pro", max: "max" } as const satisfies Record<
  PlanRole,
  PlanRole
>;

export interface PaymentDetails {
  amount: number;
  currency: string;
  start: number;
  recurring: "year" | "month";
}

export interface Invoice {
  amount_paid: number;
  currency: string;
  status: "draft" | "open" | "paid" | "uncollectible" | "void" | null;
  created: number;
  hosted_invoice_url: string | null | undefined;
  recurring: "year" | "month";
  brandName?: string;
  cardLast4?: string;
  walletType?: string;
  paymentMethodType?: string;
}

/** `POST /security/password`: a first password for an account that has none. */
export type SetPasswordBody = { newPassword: string };
