import { useAuth } from "@clerk/clerk-react";
import { toast } from "sonner";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { completeTask, deleteTask, updateTask } from "@/functions/api";
import { upsertTaskWithRecurrence } from "@/functions/functions";
import type { TaskInput } from "@dailify/shared";
import type { TaskProps } from "@/types/types";

/**
 * Concluir/excluir uma tarefa — compartilhado pelo menu (⋮) do cartão e pelo painel de edição.
 * As escritas são otimistas SÓ depois do servidor responder, como manda o `components/CLAUDE.md`.
 */
export function useTaskActions(task: TaskProps) {
  const { tasks, setTasks, selectedDay } = useDailify();
  const { getToken } = useAuth();

  const onComplete = async () => {
    const token = await getToken();
    if (!token) return;
    const { error } = await completeTask(token, task.id);
    if (error) {
      toast.error(copy.task.completeError, { description: error });
      return;
    }
    setTasks(
      upsertTaskWithRecurrence(
        tasks ?? [],
        { ...task, completed: [...task.completed, Date.now()] },
        selectedDay,
      ),
    );
  };

  const onDelete = async () => {
    const token = await getToken();
    if (!token) return;
    try {
      await deleteTask(token, task.id);
      setTasks((tasks ?? []).filter((t) => t.id !== task.id));
    } catch {
      toast.error(copy.task.deleteError);
    }
  };

  /**
   * Edição campo a campo pelo cartão (título, duração, prioridade, recorrência, links). Devolve
   * `false` pra quem chamou desfazer o que já mostrou na tela.
   */
  const onPatch = async (patch: Partial<TaskInput>): Promise<boolean> => {
    const token = await getToken();
    if (!token) return false;
    const { task: updated, error } = await updateTask(token, task.id, patch);
    if (error || !updated) {
      toast.error(copy.task.patchError, { description: error });
      return false;
    }
    setTasks(upsertTaskWithRecurrence(tasks ?? [], updated, selectedDay));
    return true;
  };

  return { onComplete, onDelete, onPatch, onRename: (title: string) => onPatch({ title }) };
}
