import { useAuth } from "@clerk/clerk-react";
import { toast } from "sonner";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { completeTask, createTask, deleteTask, updateTask } from "@/functions/api";
import { upsertTaskWithRecurrence } from "@/functions/functions";
import type { TaskInput } from "@dailify/shared";
import type { TaskProps } from "@/types/types";

/**
 * Concluir/excluir uma tarefa — compartilhado pelo menu (⋮) do cartão e pelo painel de edição.
 * As escritas são otimistas: a lista muda na hora e volta ao estado anterior se o servidor recusar.
 */
export function useTaskActions(task: TaskProps) {
  const { tasks, setTasks, selectedDay } = useDailify();
  const { getToken } = useAuth();

  /** O que restaura a lista quando o servidor recusa o que já foi mostrado na tela. */
  const rollback = (previous: TaskProps[]) => setTasks(previous);

  const onComplete = async () => {
    const previous = tasks ?? [];
    const done: TaskProps = { ...task, completed: [...task.completed, Date.now()] };
    setTasks(upsertTaskWithRecurrence(previous, done, selectedDay));

    const token = await getToken();
    if (!token) return rollback(previous);

    const { error } = await completeTask(token, task.id);
    if (error) {
      rollback(previous);
      toast.error(copy.task.completeError, { description: error.message });
    }
  };

  /** Recria a tarefa com o MESMO id — o que o servidor apagou, não o que o cliente lembrava. */
  const restore = async (previous: TaskProps[]) => {
    const token = await getToken();
    if (!token) return;

    setTasks(previous);
    const { error } = await createTask(token, { ...task, id: task.id, completed: task.completed });
    if (error) {
      setTasks(previous.filter((t) => t.id !== task.id));
      toast.error(copy.task.undoError, { description: error.message });
      return;
    }
    toast.success(copy.task.restored);
  };

  const onDelete = async () => {
    const previous = tasks ?? [];
    setTasks(previous.filter((t) => t.id !== task.id));

    const token = await getToken();
    if (!token) return rollback(previous);

    // Um 500 aqui não pode passar por sucesso: antes o cartão sumia da tela com a tarefa viva.
    const { error } = await deleteTask(token, task.id);
    if (error) {
      rollback(previous);
      toast.error(copy.task.deleteError, { description: error.message });
      return;
    }

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
    const previous = tasks ?? [];
    setTasks(upsertTaskWithRecurrence(previous, { ...task, ...patch }, selectedDay));

    const token = await getToken();
    if (!token) {
      rollback(previous);
      return false;
    }

    const { task: updated, error } = await updateTask(token, task.id, patch);
    if (error || !updated) {
      rollback(previous);
      toast.error(copy.task.patchError, { description: error?.message });
      return false;
    }

    // A resposta do servidor ainda entra: ela traz o que o patch não mandou (recorrência expandida).
    setTasks(upsertTaskWithRecurrence(previous, updated, selectedDay));
    return true;
  };

  return { onComplete, onDelete, onPatch, onRename: (title: string) => onPatch({ title }) };
}
