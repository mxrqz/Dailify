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
}

export type TaskInput = Omit<Task, "id" | "completed" | "hash"> & {
  id?: string;
  completed?: number[];
};

export type Role = "free" | "pro" | "pro+ai" | "admin";

export interface Permissions {
  taskLimits: { monthly: number; recurring: number }; // -1 = unlimited
  features: { voiceCreation: boolean };
}

export interface Entitlements {
  loading: boolean;
  voice: boolean;
  recurrence: boolean;
  monthlyLimit: number;
  unlimited: boolean;
  tasksUsed: number;
  remaining: number;
  canCreateTask: boolean;
}

export const PLAN_ID = { free: "free", pro: "pro", proAi: "pro+ai" } as const;

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
