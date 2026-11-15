export type Repeat = "Off" | "Daily" | "Monthly" | "Yearly" | { Weekly: string[] };

export interface Task {
  id: string;
  title: string;
  date: number; // epoch ms
  alert?: number; // epoch ms
  duration: string; // "10m", "1h30m"
  priority: number; // 0-4
  repeat: Repeat;
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
}

export type TaskInput = Omit<Task, "id" | "completed" | "hash"> & {
  id?: string;
  completed?: number[];
};

/**
 * Rascunho de tarefa lido de uma frase — o mesmo formato do parser local (`ParsedTask` do web,
 * sem `unsure`) com a data em epoch-ms, pra resposta da IA caber nas mesmas etiquetas do composer.
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
}

export type AiIntent = "create" | "question" | "command" | "unsupported";

/** `POST /tasks/parse`: só rascunhos — quem cria é o cliente, depois de confirmar. */
export interface AiParse {
  reply: string;
  intent: AiIntent;
  drafts: ParsedTaskWire[];
}

export type Role = "free" | "pro" | "max" | "admin";

export const PLAN_ID = { free: "free", pro: "pro", max: "max" } as const;

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
