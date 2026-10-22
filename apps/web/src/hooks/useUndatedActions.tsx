import { useAuth } from "@clerk/clerk-react";
import { toast } from "sonner";
import { doneThisPeriod, periodStart, type Task } from "@dailify/shared";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { completeTask, createTask, deleteTask, uncompleteTaskRange } from "@/functions/api";
import type { ApiError } from "@/functions/api";
import { enqueue, type Mutation } from "@/functions/offline";
import { browserTimeZone, removeUndated, upsertUndated } from "@/functions/undated";

/**
 * Marcar/desmarcar/excluir na lista Sem data. Mesmo contrato de `useTaskActions` (otimista; erro de
 * rede vai pra fila, recusa do servidor desfaz), mas contra `undatedTasks` e com marcação por
 * PERÍODO: a recorrente fica feita até o período virar, não só no dia.
 */
export function useUndatedActions(task: Task) {
  const { undatedTasks, setUndatedTasks, weekStart } = useDailify();
  const { getToken, userId } = useAuth();

  const done =
    task.repeat === "Off"
      ? task.completed.length > 0
      : doneThisPeriod(task, Date.now(), weekStart, browserTimeZone());

  /** Sem rede o Clerk também não renova o token — e isso não pode custar a escrita. */
  const authToken = async (): Promise<{ token?: string; error: ApiError | undefined }> => {
    const token = await getToken().catch(() => null);
    if (token) return { token, error: undefined };
    return {
      error: navigator.onLine
        ? { message: copy.form.authError, offline: false }
        : { message: copy.task.queued, offline: true },
    };
  };

  /** Roda a chamada e decide o desfecho: ok, fila (rede) ou rollback + toast (servidor). */
  const run = async (
    previous: Task[],
    mutation: Mutation,
    message: string,
    call: (token: string) => Promise<{ error?: ApiError }>,
  ): Promise<boolean> => {
    const { token, error: authError } = await authToken();
    const error = token ? (await call(token)).error : authError;
    if (!error) return true;

    if (error.offline && userId) {
      enqueue(userId, mutation);
      return true;
    }

    setUndatedTasks(previous);
    toast.error(message, { description: error.message });
    return false;
  };

  /** Desmarca `current` em `list`. Recorrente: só o período corrente; avulsa: tudo. */
  const reopen = async (list: Task[], current: Task) => {
    const at = Date.now();
    const from =
      current.repeat === "Off" ? 0 : periodStart(current.repeat, at, weekStart, browserTimeZone());
    setUndatedTasks(
      upsertUndated(list, {
        ...current,
        completed: current.completed.filter((c) => c < from || c > at),
        updatedAt: at,
      }),
    );
    await run(
      list,
      { op: "uncomplete", taskId: current.id, day: from, until: at, at },
      copy.task.uncompleteError,
      (t) => uncompleteTaskRange(t, current.id, from, at),
    );
  };

  const toggle = async () => {
    const at = Date.now();
    const previous = undatedTasks ?? [];
    if (done) return reopen(previous, task);

    const completed = { ...task, completed: [...task.completed, at], updatedAt: at };
    const next = upsertUndated(previous, completed);
    setUndatedTasks(next);
    const ok = await run(
      previous,
      { op: "complete", taskId: task.id, at },
      copy.task.completeError,
      (t) => completeTask(t, task.id, at),
    );
    // Avulsa concluída some da lista: sem o desfazer, um toque errado não tem volta.
    if (ok && task.repeat === "Off") {
      toast.success(copy.task.completed, {
        description: task.title,
        duration: 6000,
        action: { label: copy.task.undo, onClick: () => void reopen(next, completed) },
      });
    }
  };

  /** Recria com o MESMO id — desfazer a exclusão. */
  const restore = async (previous: Task[]) => {
    const at = Date.now();
    const input = { ...task, updatedAt: at };
    setUndatedTasks(previous);
    const ok = await run(
      removeUndated(previous, task.id),
      { op: "create", taskId: task.id, input, at },
      copy.task.undoError,
      (t) => createTask(t, input),
    );
    if (ok) toast.success(copy.task.restored);
  };

  const remove = async () => {
    const at = Date.now();
    const previous = undatedTasks ?? [];
    setUndatedTasks(removeUndated(previous, task.id));

    const ok = await run(
      previous,
      { op: "delete", taskId: task.id, at },
      copy.task.deleteError,
      (t) => deleteTask(t, task.id),
    );
    if (!ok) return;

    toast.success(copy.task.deleted, {
      description: task.title,
      duration: 6000,
      action: { label: copy.task.undo, onClick: () => void restore(previous) },
    });
  };

  return { done, toggle, remove };
}
