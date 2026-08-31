import type { Task, TaskInput } from "@dailify/shared";

import { completeTask, createTask, deleteTask, uncompleteTask, updateTask } from "./api";
import type { ApiError } from "./api";

/**
 * O que ainda não chegou no servidor. Cada entrada é uma chamada da API que falhou por rede — a
 * fila não inventa um protocolo próprio, ela repete as rotas que já existem.
 */
export type Mutation =
  | { op: "create"; taskId: string; input: TaskInput; at: number }
  | { op: "patch"; taskId: string; patch: Partial<TaskInput>; at: number }
  | { op: "complete"; taskId: string; at: number }
  | { op: "uncomplete"; taskId: string; day: number; at: number }
  | { op: "delete"; taskId: string; at: number };

const key = (userId: string, what: "tasks" | "outbox") => `dailify:${what}:${userId}`;

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
 * - `complete` e `uncomplete` se cancelam: só o último estado importa.
 */
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
      const rest = out.filter(
        (m) => !(sameTask(m) && (m.op === "complete" || m.op === "uncomplete")),
      );
      out.length = 0;
      out.push(...rest, mutation);
      continue;
    }

    if (mutation.op === "patch") {
      const create = out.find((m) => sameTask(m) && m.op === "create");
      if (create && create.op === "create") {
        // Editar algo que ainda nem subiu: a criação já vai com a edição embutida.
        create.input = { ...create.input, ...mutation.patch };
        create.at = mutation.at;
        continue;
      }

      const previous = out.find((m) => sameTask(m) && m.op === "patch");
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
  writeQueue(userId, collapseQueue([...readQueue(userId), mutation]));
}

export const pendingCount = (userId: string): number => readQueue(userId).length;

/**
 * Sobe a fila em ordem. Para no primeiro erro de REDE (a ordem importa: criar antes de editar), e
 * descarta a entrada num erro de servidor — quota estourada, tarefa que não existe mais. Retentar
 * pra sempre o que o servidor recusa é como uma fila entope.
 */
export async function flushQueue(
  userId: string,
  token: string,
): Promise<{ sent: number; dropped: number; offline: boolean }> {
  const queue = readQueue(userId);
  let sent = 0;
  let dropped = 0;

  while (queue.length) {
    const mutation = queue[0];
    const error = await send(token, mutation);

    if (error?.offline) {
      writeQueue(userId, queue);
      return { sent, dropped, offline: true };
    }

    queue.shift();
    if (error) dropped++;
    else sent++;
  }

  writeQueue(userId, queue);
  return { sent, dropped, offline: false };
}

async function send(token: string, mutation: Mutation): Promise<ApiError | undefined> {
  switch (mutation.op) {
    case "create":
      return (await createTask(token, { ...mutation.input, id: mutation.taskId })).error;
    case "patch":
      return (await updateTask(token, mutation.taskId, mutation.patch)).error;
    case "complete":
      return (await completeTask(token, mutation.taskId, mutation.at)).error;
    case "uncomplete":
      return (await uncompleteTask(token, mutation.taskId, new Date(mutation.day))).error;
    case "delete":
      return (await deleteTask(token, mutation.taskId)).error;
  }
}
