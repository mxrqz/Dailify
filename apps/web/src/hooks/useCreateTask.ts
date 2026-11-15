import { useRef, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { ParsedTask, Task } from "@dailify/shared";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { createTask, deleteTask } from "@/functions/api";
import { composeTaskInput } from "@/functions/compose-input";
import { upsertTaskWithRecurrence } from "@/functions/functions";
import { enqueue, newTaskId } from "@/functions/offline";
import { upsertUndated } from "@/functions/undated";
import { useQuotas } from "@/hooks/useQuotas";
import { zoned } from "@/functions/zone";

/**
 * Tarefas que já existem no servidor (a voz, os rascunhos da Mew): põe na agenda ou no A qualquer
 * hora e avisa com Desfazer.
 */
export function useShowCreated() {
  const { getToken } = useAuth();
  const { tasks, setTasks, undatedTasks, setUndatedTasks, loadedMonths, bumpUsage } = useDailify();
  // A resposta chega segundos depois do toque; as listas de agora, não as daquele render.
  const latest = useRef({ tasks, undatedTasks });
  latest.current = { tasks, undatedTasks };

  const undo = async (created: Task[]) => {
    const ids = new Set(created.map((t) => t.id));
    setTasks((latest.current.tasks ?? []).filter((t) => !ids.has(t.id)));
    setUndatedTasks((latest.current.undatedTasks ?? []).filter((t) => !ids.has(t.id)));
    const token = await getToken();
    if (token) await Promise.all(created.map((t) => deleteTask(token, t.id)));
  };

  return (created: Task[], message: string) => {
    setTasks(
      created
        .filter((t) => !t.undated)
        .reduce(
          (list, task) => upsertTaskWithRecurrence(list, task, loadedMonths),
          latest.current.tasks ?? [],
        ),
    );
    setUndatedTasks(
      created.filter((t) => t.undated).reduce(upsertUndated, latest.current.undatedTasks ?? []),
    );
    created.forEach(() => bumpUsage("tasks"));
    toast.success(message, {
      description: created.map((t) => t.title).join(" · "),
      action: { label: copy.task.undo, onClick: () => void undo(created) },
    });
  };
}

/**
 * Criar a partir do texto já interpretado — o composer do dashboard e o campo do bloco A qualquer hora.
 * Devolve `true` quando a tarefa existe (no servidor ou na fila), pra quem chamou limpar o campo.
 */
export function useCreateTask() {
  const { getToken, userId } = useAuth();
  const { tasks, setTasks, undatedTasks, setUndatedTasks, bumpUsage, loadedMonths } = useDailify();
  const quotas = useQuotas();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const showCreated = useShowCreated();

  const limited = () => {
    if (!quotas.states.tasks.exhausted) return false;
    toast(copy.form.limitReached, {
      description: copy.form.limitReachedHint,
      action: { label: copy.form.upgrade, onClick: () => navigate("/premium") },
    });
    return true;
  };

  const create = async (
    parsed: ParsedTask,
    { undatedOnly }: { undatedOnly?: boolean } = {},
  ): Promise<boolean> => {
    if (limited()) return false;

    setSubmitting(true);

    // `finally`: qualquer exceção no meio (o token do Clerk, o parser) deixava o botão girando
    // pra sempre — o mesmo modo de falha que `protected-route.tsx` já tinha aprendido.
    // O id nasce aqui, não no servidor: sem rede a tarefa precisa existir na tela e na fila com
    // uma identidade estável, e o upsert do servidor aceita o id do cliente sem duplicar.
    const at = Date.now();
    const input = {
      ...composeTaskInput(parsed, zoned(at), { undatedOnly }),
      id: newTaskId(),
      updatedAt: at,
    };
    const undated = input.undated === true;
    const previous = (undated ? undatedTasks : tasks) ?? [];
    const optimistic = { ...input, repeatEvery: input.repeatEvery ?? undefined, completed: [] };
    const apply = (list: Task[], task: Task) =>
      undated
        ? setUndatedTasks(upsertUndated(list, task))
        : setTasks(upsertTaskWithRecurrence(list, task, loadedMonths));
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
      toast.message(undated ? copy.form.createdUndated : copy.form.created, {
        description: task.title,
      });
      return true;
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Os rascunhos da Mew, confirmados juntos: sem otimismo nem fila (só aparece online), e um
   * Desfazer pra todos. `true` quando ao menos um foi criado — repetir duplicaria os que entraram.
   */
  const createMany = async (list: ParsedTask[]): Promise<boolean> => {
    if (limited()) return false;
    setSubmitting(true);
    try {
      const token = await getToken().catch(() => null);
      const created: Task[] = [];
      for (const parsed of list) {
        const at = Date.now();
        const input = { ...composeTaskInput(parsed, zoned(at)), id: newTaskId(), updatedAt: at };
        const { task, error } = token
          ? await createTask(token, input)
          : { task: undefined, error: undefined };
        if (!task) {
          toast.error(copy.form.createError, { description: error?.message });
          break;
        }
        created.push(task);
      }
      if (created.length) {
        showCreated(created, copy.mew.createdMany.replace("{n}", String(created.length)));
      }
      return created.length > 0;
    } finally {
      setSubmitting(false);
    }
  };

  return { create, createMany, submitting };
}
