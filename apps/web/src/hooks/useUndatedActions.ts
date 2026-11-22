import { toast } from "sonner";
import { doneThisPeriod, periodStart, type Task } from "@dailify/shared";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import {
  completeTask,
  createTask,
  deleteTask,
  uncompleteTaskRange,
  updateTask,
} from "@/functions/api";
import type { ApiError } from "@/functions/api";
import { upsertTaskWithRecurrence } from "@/functions/functions";
import { revertTask } from "@/functions/revert-task";
import { enqueue, shouldQueue, type Mutation } from "@/functions/offline";
import { removeUndated, upsertUndated } from "@/functions/undated";
import { appTimeZone } from "@/functions/zone";
import { useUser } from "@/hooks/useUser";

/**
 * Marcar/desmarcar/excluir/agendar na lista Sem data. Mesmo contrato de `useTaskActions` (otimista; erro de
 * rede vai pra fila, recusa do servidor desfaz), mas contra `undatedTasks` e com marcação por
 * PERÍODO: a recorrente fica feita até o período virar, não só no dia.
 */
export function useUndatedActions(task: Task) {
  const { undatedTasks, setUndatedTasks, tasks, setTasks, loadedMonths, weekStart } = useDailify();
  const userId = useUser()?.id;

  const done =
    task.repeat === "Off"
      ? task.completed.length > 0
      : doneThisPeriod(task, Date.now(), weekStart, appTimeZone());

  /** Roda a chamada e decide o desfecho: ok, fila (rede) ou rollback + toast (servidor). */
  const run = async (
    previous: Task[],
    mutation: Mutation,
    message: string,
    call: () => Promise<{ error?: ApiError }>,
  ): Promise<boolean> => {
    const { error } = await call();
    if (!error) return true;

    if (shouldQueue(error) && userId) {
      enqueue(userId, mutation);
      return true;
    }

    setUndatedTasks((cur) => revertTask(cur ?? [], previous, task.id));
    toast.error(message, { description: error.message });
    return false;
  };

  /** Desmarca `current`. Recorrente: só o período corrente; avulsa: tudo. */
  const reopen = async (current: Task) => {
    const at = Date.now();
    const from =
      current.repeat === "Off"
        ? 0
        : periodStart(
            current.repeat,
            at,
            weekStart,
            appTimeZone(),
            current.repeatEvery,
            current.date,
          );
    setUndatedTasks((cur) =>
      upsertUndated(cur ?? [], {
        ...current,
        completed: current.completed.filter((c) => c < from || c > at),
        updatedAt: at,
      }),
    );
    await run(
      [current],
      { op: "uncomplete", taskId: current.id, day: from, until: at, at },
      copy.task.uncompleteError,
      () => uncompleteTaskRange(current.id, from, at),
    );
  };

  const toggle = async () => {
    const at = Date.now();
    const previous = undatedTasks ?? [];
    if (done) return reopen(task);

    const completed = { ...task, completed: [...task.completed, at], updatedAt: at };
    setUndatedTasks((cur) => upsertUndated(cur ?? [], completed));
    const ok = await run(
      previous,
      { op: "complete", taskId: task.id, at },
      copy.task.completeError,
      () => completeTask(task.id, at),
    );
    // Avulsa concluída some da lista: sem o desfazer, um toque errado não tem volta.
    if (ok && task.repeat === "Off") {
      toast.success(copy.task.completed, {
        description: task.title,
        duration: 6000,
        action: { label: copy.task.undo, onClick: () => void reopen(completed) },
      });
    }
  };

  /** Recria com o MESMO id — desfazer a exclusão. */
  const restore = async () => {
    const at = Date.now();
    const input = { ...task, updatedAt: at };
    setUndatedTasks((cur) => upsertUndated(cur ?? [], task));
    const ok = await run(
      [],
      { op: "create", taskId: task.id, input, at },
      copy.task.undoError,
      () => createTask(input),
    );
    if (ok) toast.success(copy.task.restored);
  };

  const remove = async () => {
    const at = Date.now();
    const previous = undatedTasks ?? [];
    setUndatedTasks((cur) => removeUndated(cur ?? [], task.id));

    const ok = await run(
      previous,
      { op: "delete", taskId: task.id, at },
      copy.task.deleteError,
      () => deleteTask(task.id),
    );
    if (!ok) return;

    toast.success(copy.task.deleted, {
      description: task.title,
      duration: 6000,
      action: { label: copy.task.undo, onClick: () => void restore() },
    });
  };

  /** Sai da Sem data pra agenda em `at` (soltar num dia). O alerta vira o horário, como na edição. */
  const schedule = async (at: number) => {
    const now = Date.now();
    const previous = undatedTasks ?? [];
    const agenda = tasks ?? [];
    const patch = { date: at, alert: at, undated: false, updatedAt: now };
    setUndatedTasks((cur) => removeUndated(cur ?? [], task.id));
    setTasks((cur) => upsertTaskWithRecurrence(cur ?? [], { ...task, ...patch }, loadedMonths));

    const ok = await run(
      previous,
      { op: "patch", taskId: task.id, patch, at: now },
      copy.task.patchError,
      () => updateTask(task.id, patch),
    );
    if (!ok) setTasks((cur) => revertTask(cur ?? [], agenda, task.id));
  };

  return { done, toggle, remove, schedule };
}
