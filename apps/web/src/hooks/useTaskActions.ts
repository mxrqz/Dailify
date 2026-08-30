import { useAuth } from "@clerk/clerk-react";
import { toast } from "sonner";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { completeTask, createTask, deleteTask, uncompleteTask, updateTask } from "@/functions/api";
import type { ApiError } from "@/functions/api";
import { upsertTaskWithRecurrence } from "@/functions/functions";
import { enqueue, type Mutation } from "@/functions/offline";
import type { TaskInput } from "@dailify/shared";
import type { TaskProps } from "@/types/types";

/**
 * Concluir/reabrir/editar/excluir — compartilhado pelo menu (⋮) do cartão e pela folha de edição.
 *
 * As escritas são otimistas e o erro tem dois desfechos: falha de REDE mantém o que está na tela e
 * guarda a mutação na fila (é o que faz o app funcionar sem conexão); falha de SERVIDOR desfaz,
 * porque aí a recusa é definitiva.
 */
export function useTaskActions(task: TaskProps, day: Date = new Date()) {
  const { tasks, setTasks, selectedDay } = useDailify();
  const { getToken, userId } = useAuth();

  const rollback = (previous: TaskProps[]) => setTasks(previous);

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

  const settle = (
    error: ApiError | undefined,
    previous: TaskProps[],
    mutation: Mutation,
    message: string,
  ): boolean => {
    if (!error) return true;

    if (error.offline && userId) {
      enqueue(userId, mutation);
      return true;
    }

    rollback(previous);
    toast.error(message, { description: error.message });
    return false;
  };

  const onComplete = async () => {
    const at = Date.now();
    const previous = tasks ?? [];
    const done: TaskProps = { ...task, completed: [...task.completed, at], updatedAt: at };
    setTasks(upsertTaskWithRecurrence(previous, done, selectedDay));

    const mutation: Mutation = { op: "complete", taskId: task.id, at };
    const { token, error: authError } = await authToken();
    if (!token) {
      settle(authError, previous, mutation, copy.task.completeError);
      return;
    }

    const { error } = await completeTask(token, task.id, at);
    settle(error, previous, mutation, copy.task.completeError);
  };

  /** Reabre a ocorrência DESTE dia: a recorrente é concluída por ocorrência, não de uma vez. */
  const onUncomplete = async () => {
    const at = Date.now();
    const previous = tasks ?? [];
    const from = new Date(day).setHours(0, 0, 0, 0);
    const to = new Date(day).setHours(23, 59, 59, 999);
    const reopened: TaskProps = {
      ...task,
      completed: task.completed.filter((done) => done < from || done > to),
      updatedAt: at,
    };
    setTasks(upsertTaskWithRecurrence(previous, reopened, selectedDay));

    const mutation: Mutation = { op: "uncomplete", taskId: task.id, day: from, at };
    const { token, error: authError } = await authToken();
    if (!token) {
      settle(authError, previous, mutation, copy.task.uncompleteError);
      return;
    }

    const { error } = await uncompleteTask(token, task.id, day);
    settle(error, previous, mutation, copy.task.uncompleteError);
  };

  /** Recria a tarefa com o MESMO id — o que o servidor apagou, não o que o cliente lembrava. */
  const restore = async (previous: TaskProps[]) => {
    const at = Date.now();
    const input = { ...task, id: task.id, completed: task.completed, updatedAt: at };
    const withoutTask = previous.filter((t) => t.id !== task.id);
    setTasks(previous);

    const mutation: Mutation = { op: "create", taskId: task.id, input, at };
    const { token, error: authError } = await authToken();
    if (!token) {
      settle(authError, withoutTask, mutation, copy.task.undoError);
      return;
    }

    const { error } = await createTask(token, input);
    if (settle(error, withoutTask, mutation, copy.task.undoError))
      toast.success(copy.task.restored);
  };

  const onDelete = async () => {
    const at = Date.now();
    const previous = tasks ?? [];
    setTasks(previous.filter((t) => t.id !== task.id));

    const mutation: Mutation = { op: "delete", taskId: task.id, at };
    const { token, error: authError } = await authToken();
    if (!token) {
      settle(authError, previous, mutation, copy.task.deleteError);
      return;
    }

    // Um 500 aqui não pode passar por sucesso: antes o cartão sumia da tela com a tarefa viva.
    const { error } = await deleteTask(token, task.id);
    if (!settle(error, previous, mutation, copy.task.deleteError)) return;

    // Desfazer no lugar de um diálogo de confirmação: não cobra um toque a mais das exclusões
    // certas, e cobre a errada.
    toast.success(copy.task.deleted, {
      description: task.title,
      duration: 6000,
      action: { label: copy.task.undo, onClick: () => void restore(previous) },
    });
  };

  /**
   * Edição campo a campo pelo cartão (título, duração, prioridade, recorrência, links). Devolve
   * `false` pra quem chamou desfazer o que já mostrou na tela.
   */
  const onPatch = async (patch: Partial<TaskInput>): Promise<boolean> => {
    const at = Date.now();
    const previous = tasks ?? [];
    const stamped = { ...patch, updatedAt: at };
    setTasks(upsertTaskWithRecurrence(previous, { ...task, ...stamped }, selectedDay));

    const mutation: Mutation = { op: "patch", taskId: task.id, patch: stamped, at };
    const { token, error: authError } = await authToken();
    if (!token) return settle(authError, previous, mutation, copy.task.patchError);

    const { task: updated, error } = await updateTask(token, task.id, stamped);
    if (!settle(error, previous, mutation, copy.task.patchError)) return false;
    if (!updated) return true; // foi pra fila: o que está na tela já é o estado bom

    // A resposta do servidor ainda entra: ela traz o que o patch não mandou (recorrência expandida).
    setTasks(upsertTaskWithRecurrence(previous, updated, selectedDay));
    return true;
  };

  return {
    onComplete,
    onUncomplete,
    onDelete,
    onPatch,
    onRename: (title: string) => onPatch({ title }),
  };
}
