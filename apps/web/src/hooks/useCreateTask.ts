import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { Task } from "@dailify/shared";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { createTask } from "@/functions/api";
import { composeTaskInput } from "@/functions/compose-input";
import { upsertTaskWithRecurrence } from "@/functions/functions";
import { enqueue, newTaskId } from "@/functions/offline";
import type { ParsedTask } from "@/functions/parse-task";
import { upsertUndated } from "@/functions/undated";
import { useQuotas } from "@/hooks/useQuotas";

/**
 * Criar a partir do texto já interpretado — o composer do dashboard e o campo da Sem data.
 * Devolve `true` quando a tarefa existe (no servidor ou na fila), pra quem chamou limpar o campo.
 */
export function useCreateTask() {
  const { getToken, userId } = useAuth();
  const { tasks, setTasks, undatedTasks, setUndatedTasks, bumpUsage, selectedDay } = useDailify();
  const quotas = useQuotas();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const create = async (
    parsed: ParsedTask,
    { undatedOnly }: { undatedOnly?: boolean } = {},
  ): Promise<boolean> => {
    if (quotas.states.tasks.exhausted) {
      toast(copy.form.limitReached, {
        description: copy.form.limitReachedHint,
        action: { label: copy.form.upgrade, onClick: () => navigate("/premium") },
      });
      return false;
    }

    setSubmitting(true);

    // `finally`: qualquer exceção no meio (o token do Clerk, o parser) deixava o botão girando
    // pra sempre — o mesmo modo de falha que `protected-route.tsx` já tinha aprendido.
    // O id nasce aqui, não no servidor: sem rede a tarefa precisa existir na tela e na fila com
    // uma identidade estável, e o upsert do servidor aceita o id do cliente sem duplicar.
    const at = Date.now();
    const input = {
      ...composeTaskInput(parsed, new Date(at), { undatedOnly }),
      id: newTaskId(),
      updatedAt: at,
    };
    const undated = input.undated === true;
    const previous = (undated ? undatedTasks : tasks) ?? [];
    const optimistic = { ...input, completed: [] };
    const apply = (list: Task[], task: Task) =>
      undated
        ? setUndatedTasks(upsertUndated(list, task))
        : setTasks(upsertTaskWithRecurrence(list, task, selectedDay));
    const restore = (list: Task[]) => (undated ? setUndatedTasks(list) : setTasks(list));
    apply(previous, optimistic);

    try {
      const token = await getToken().catch(() => null);

      const { task, error } = token
        ? await createTask(token, input)
        : { task: undefined, error: { message: copy.task.queued, offline: !navigator.onLine } };

      if (error?.offline && userId) {
        enqueue(userId, { op: "create", taskId: input.id, input, at });
        toast.message(undated ? copy.form.createdUndated : copy.form.created, {
          description: copy.task.queued,
        });
        return true;
      }

      if (error || !task) {
        restore(previous);
        toast(copy.form.createError, {
          description: error?.message,
          action: { label: copy.form.upgrade, onClick: () => navigate("/premium") },
        });
        return false;
      }

      apply(previous, task);
      bumpUsage("tasks");
      if (task.repeat !== "Off") bumpUsage("recurring");
      toast.message(undated ? copy.form.createdUndated : copy.form.created, {
        description: task.title,
      });
      return true;
    } finally {
      setSubmitting(false);
    }
  };

  return { create, submitting };
}
