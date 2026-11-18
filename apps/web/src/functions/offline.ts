import { endOfDay, startOfDay } from "date-fns";
import type { Task, TaskInput } from "@dailify/shared";

import {
  completeTask,
  createTask,
  deleteTask,
  uncompleteTask,
  uncompleteTaskRange,
  updateTask,
} from "./api";
import type { ApiError } from "./api";
import { zoned } from "./zone";

/** O corpo do PATCH: `alert: null` limpa o lembrete. */
type TaskPatch = Parameters<typeof updateTask>[1];

/**
 * O que ainda não chegou no servidor. Cada entrada é uma chamada da API que falhou por rede — a
 * fila não inventa um protocolo próprio, ela repete as rotas que já existem.
 */
export type Mutation =
  | { op: "create"; taskId: string; input: TaskInput; at: number }
  // `occurrence`: a edição vale só pra essa instância da série (o servidor a destaca).
  | { op: "patch"; taskId: string; patch: TaskPatch; at: number; occurrence?: number }
  | { op: "complete"; taskId: string; at: number }
  // `until` = desfazer o intervalo [day, until] (período de recorrência da Sem data), não o dia.
  | { op: "uncomplete"; taskId: string; day: number; at: number; until?: number }
  | { op: "delete"; taskId: string; at: number }
  // Op própria, não um `delete` com campo extra: excluir a terça de uma série não pode colapsar
  // como exclusão da tarefa (o colapso do `delete` engole o create e os patches pendentes dela).
  | { op: "delete-occurrence"; taskId: string; occurrence: number; at: number };

const key = (userId: string, what: "tasks" | "outbox" | "undated") => `dailify:${what}:${userId}`;

/** A conversa com a Mew (`components/mew-chat/thread.ts`); mora aqui pro `clearLocal` não esquecê-la. */
export const chatKey = (userId: string) => `mewki:mew:${userId}:v1`;

/**
 * Id da tarefa nascido no cliente. `crypto.randomUUID` só existe em contexto seguro — testar no
 * celular por `http://192.168.x.x` cairia num `undefined is not a function` bem no botão de criar.
 */
export const newTaskId = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

/**
 * `localStorage` e não IndexedDB: a agenda de um mês são dezenas de KB, muito abaixo dos 5MB, e o
 * síncrono aqui custa ~1ms. Se um dia isso virar histórico inteiro, aí sim vale a mudança.
 *
 * Tudo em try/catch porque em aba privada e com cookies de terceiros bloqueados o próprio acesso
 * lança — e o cache é conveniência: ele não pode derrubar a escrita que estava sendo feita.
 */
function read<T>(storageKey: string): T | undefined {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function write(storageKey: string, value: unknown): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(value));
  } catch {
    /* sem espaço ou sem permissão: segue sem cache */
  }
}

export const readCachedTasks = (userId: string): Task[] | undefined =>
  read<Task[]>(key(userId, "tasks"));

export const cacheTasks = (userId: string, tasks: Task[]): void =>
  write(key(userId, "tasks"), tasks);

export const readCachedUndated = (userId: string): Task[] | undefined =>
  read<Task[]>(key(userId, "undated"));

export const cacheUndated = (userId: string, tasks: Task[]): void =>
  write(key(userId, "undated"), tasks);

/** Quem estava logado: offline o get-session falha e, sem isto, o gate não sabe de quem é o cache. */
export interface LastUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  plan?: string | null;
}

const LAST_USER = "dailify:last-user";

export const rememberUser = ({ id, name, email, image, plan }: LastUser): void =>
  write(LAST_USER, { id, name, email, image, plan });

export function readLastUser(): LastUser | undefined {
  const user = read<Partial<LastUser>>(LAST_USER);
  return typeof user?.id === "string" && typeof user.email === "string"
    ? { id: user.id, name: user.name ?? "", email: user.email, image: user.image, plan: user.plan }
    : undefined;
}

export function forgetUser(): void {
  try {
    localStorage.removeItem(LAST_USER);
  } catch {
    /* sem acesso ao storage: não havia o que limpar */
  }
}

export const readQueue = (userId: string): Mutation[] =>
  read<Mutation[]>(key(userId, "outbox")) ?? [];

const writeQueue = (userId: string, queue: Mutation[]): void => write(key(userId, "outbox"), queue);

/**
 * Colapsa o que é redundante antes de guardar. Um dia offline mexendo na mesma tarefa não deve
 * virar quarenta chamadas quando a rede voltar.
 *
 * - `patch` + `patch` da mesma tarefa viram um só (o mais novo ganha campo a campo);
 * - `delete` apaga o que estava pendente daquela tarefa — e some junto com o `create` dela, porque
 *   criar e excluir offline é o mesmo que nunca ter existido;
 * - `complete` e `uncomplete` do mesmo dia se cancelam: só o último estado importa.
 */
// What a check is about: the day of a complete's stamp or an uncomplete's `day` (app zone), or
// an undated uncomplete's whole [day, until] period.
const checkSpan = (m: Extract<Mutation, { op: "complete" | "uncomplete" }>): [number, number] => {
  if (m.op === "uncomplete" && m.until !== undefined) return [m.day, m.until];
  const day = zoned(m.op === "complete" ? m.at : m.day);
  return [+startOfDay(day), +endOfDay(day)];
};

export function collapseQueue(queue: Mutation[]): Mutation[] {
  const out: Mutation[] = [];

  // Cópia rasa de cada entrada: dobrar um patch dentro de outro escreve no objeto, e escrever no
  // que veio de fora faria a fila em memória divergir da que está no storage.
  for (const original of queue) {
    const mutation: Mutation = { ...original };
    const sameTask = (m: Mutation) => m.taskId === mutation.taskId;

    if (mutation.op === "delete") {
      const created = out.some((m) => sameTask(m) && m.op === "create");
      const rest = out.filter((m) => !sameTask(m));
      out.length = 0;
      out.push(...rest);
      if (!created) out.push(mutation);
      continue;
    }

    if (mutation.op === "complete" || mutation.op === "uncomplete") {
      // Per day: completion is read per occurrence, so reopening Tuesday never cancels Monday.
      const [from, to] = checkSpan(mutation);
      const overlaps = (m: Extract<Mutation, { op: "complete" | "uncomplete" }>) => {
        const [start, end] = checkSpan(m);
        return start <= to && from <= end;
      };
      const rest = out.filter(
        (m) => !(sameTask(m) && (m.op === "complete" || m.op === "uncomplete") && overlaps(m)),
      );
      out.length = 0;
      out.push(...rest, mutation);
      continue;
    }

    if (mutation.op === "patch") {
      const create = out.find((m) => sameTask(m) && m.op === "create");
      if (create && create.op === "create" && mutation.occurrence === undefined) {
        // Editar algo que ainda nem subiu: a criação já vai com a edição embutida.
        const { alert } = mutation.patch;
        create.input = {
          ...create.input,
          ...mutation.patch,
          alert: alert === undefined ? create.input.alert : (alert ?? undefined),
        };
        create.at = mutation.at;
        continue;
      }

      const previous = out.find(
        (m) => sameTask(m) && m.op === "patch" && m.occurrence === mutation.occurrence,
      );
      if (previous && previous.op === "patch") {
        previous.patch = { ...previous.patch, ...mutation.patch };
        previous.at = mutation.at;
        continue;
      }
    }

    out.push(mutation);
  }

  return out;
}

export function enqueue(userId: string, mutation: Mutation): void {
  const queue = [...readQueue(userId), mutation];
  // Com a cabeça no ar, colapsar com ela apagaria o que o servidor já recebeu (criar + excluir).
  writeQueue(userId, flushing.has(userId) ? queue : collapseQueue(queue));
}

type FlushResult = { sent: number; dropped: number; offline: boolean };

// Duas subidas juntas reenviariam a mesma entrada; a segunda chamada espera a que já está no ar.
const flushing = new Map<string, Promise<FlushResult>>();

export const pendingCount = (userId: string): number => readQueue(userId).length;

/** Apaga o rastro local do usuário. A conta some do servidor; o aparelho não pode ficar com cópia. */
export function clearLocal(userId: string): void {
  try {
    localStorage.removeItem(key(userId, "tasks"));
    localStorage.removeItem(key(userId, "outbox"));
    localStorage.removeItem(key(userId, "undated"));
    localStorage.removeItem(chatKey(userId));
    localStorage.removeItem(LAST_USER);
  } catch {
    /* sem acesso ao storage: não havia o que limpar */
  }
}

/**
 * Sobe a fila em ordem. Para no primeiro erro de REDE (a ordem importa: criar antes de editar), e
 * descarta a entrada num erro de servidor — quota estourada, tarefa que não existe mais. Retentar
 * pra sempre o que o servidor recusa é como uma fila entope. Um 401 conta como rede: a sessão caiu
 * (aba velha, troca de conta), não a edição — ela espera o próximo login.
 */
export function flushQueue(userId: string): Promise<FlushResult> {
  const running = flushing.get(userId);
  if (running) return running;
  // Começa no próximo tique: o `flushing` já tem que estar marcado quando o primeiro envio sair.
  const flush = Promise.resolve()
    .then(() => drainQueue(userId))
    .finally(() => flushing.delete(userId));
  flushing.set(userId, flush);
  return flush;
}

/** A 401 waits like a network error: the session dropped (stale tab, account switch), not the write. */
export const shouldQueue = (error?: ApiError): boolean =>
  !!error && (error.offline || error.status === 401);

// Lê a fila guardada a cada passo, não um retrato do começo: o que entra durante a subida não se perde.
async function drainQueue(userId: string): Promise<FlushResult> {
  let sent = 0;
  let dropped = 0;

  for (let mutation = readQueue(userId)[0]; mutation; mutation = readQueue(userId)[0]) {
    const error = await send(mutation);

    if (shouldQueue(error)) {
      writeQueue(userId, collapseQueue(readQueue(userId)));
      return { sent, dropped, offline: true };
    }

    // Pela entrada, não pela posição: outra aba pode ter subido (e tirado) a cabeça nesse meio-tempo,
    // e um `slice(1)` levaria junto a entrada seguinte, que ninguém enviou.
    const sentKey = JSON.stringify(mutation);
    const queue = readQueue(userId);
    const index = queue.findIndex((m) => JSON.stringify(m) === sentKey);
    if (index >= 0) queue.splice(index, 1);
    writeQueue(userId, queue);
    if (error) dropped++;
    else sent++;
  }

  return { sent, dropped, offline: false };
}

async function send(mutation: Mutation): Promise<ApiError | undefined> {
  switch (mutation.op) {
    case "create":
      return (await createTask({ ...mutation.input, id: mutation.taskId })).error;
    case "patch":
      return (await updateTask(mutation.taskId, mutation.patch, mutation.occurrence)).error;
    case "complete":
      return (await completeTask(mutation.taskId, mutation.at)).error;
    case "uncomplete":
      return mutation.until === undefined
        ? (await uncompleteTask(mutation.taskId, zoned(mutation.day))).error
        : (await uncompleteTaskRange(mutation.taskId, mutation.day, mutation.until)).error;
    case "delete":
      return (await deleteTask(mutation.taskId)).error;
    case "delete-occurrence":
      return (await deleteTask(mutation.taskId, mutation.occurrence)).error;
  }
}
