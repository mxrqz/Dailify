import { useAuth } from "@clerk/clerk-react";
import { toast } from "sonner";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { completeTask, deleteTask } from "@/functions/api";
import { upsertTaskById } from "@/functions/functions";
import type { TaskProps } from "@/types/types";

/**
 * Concluir/excluir uma tarefa — compartilhado pelo menu (⋮) do cartão e pelo painel de edição.
 * As escritas são otimistas SÓ depois do servidor responder, como manda o `components/CLAUDE.md`.
 */
export function useTaskActions(task: TaskProps) {
  const { tasks, setTasks } = useDailify();
  const { getToken } = useAuth();

  const onComplete = async () => {
    const token = await getToken();
    if (!token) return;
    const { error } = await completeTask(token, task.id);
    if (error) {
      toast.error(copy.task.completeError, { description: error });
      return;
    }
    setTasks(upsertTaskById(tasks ?? [], { ...task, completed: [...task.completed, Date.now()] }));
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

  return { onComplete, onDelete };
}
