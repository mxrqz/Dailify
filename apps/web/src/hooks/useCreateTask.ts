import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { composeTaskInput, type ParsedTask, type Task } from "@dailify/shared";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { createTask, deleteTask } from "@/functions/api";
import { upsertTaskWithRecurrence } from "@/functions/functions";
import { enqueue, newTaskId } from "@/functions/offline";
import { upsertUndated } from "@/functions/undated";
import { useCalendarPush, type CalendarPick } from "@/hooks/useCalendarPush";
import { useQuotas } from "@/hooks/useQuotas";
import { zoned } from "@/functions/zone";
import { useSession } from "@/lib/auth";

/**
 * Tarefas que já existem no servidor (a voz, os rascunhos da Mew): põe na agenda ou no A qualquer
 * hora e avisa com Desfazer.
 */
export function useShowCreated() {
  const { tasks, setTasks, undatedTasks, setUndatedTasks, loadedMonths, bumpUsage } = useDailify();
  // A resposta chega segundos depois do toque; as listas de agora, não as daquele render.
  const latest = useRef({ tasks, undatedTasks });
  latest.current = { tasks, undatedTasks };

  const undo = async (created: Task[]) => {
    const ids = new Set(created.map((t) => t.id));
    setTasks((latest.current.tasks ?? []).filter((t) => !ids.has(t.id)));
    setUndatedTasks((latest.current.undatedTasks ?? []).filter((t) => !ids.has(t.id)));
    await Promise.all(created.map((t) => deleteTask(t.id)));
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
  const userId = useSession().data?.user.id;
  const { setTasks, setUndatedTasks, bumpUsage, loadedMonths } = useDailify();
  const quotas = useQuotas();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const showCreated = useShowCreated();
  const pushCalendar = useCalendarPush();

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
    { undatedOnly, calendar }: { undatedOnly?: boolean; calendar?: CalendarPick } = {},
  ): Promise<boolean> => {
    if (limited()) return false;

    setSubmitting(true);

    // `finally`: qualquer exceção no meio (o parser, a rede) deixava o botão girando
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
    const optimistic = { ...input, repeatEvery: input.repeatEvery ?? undefined, completed: [] };
    const apply = (task: Task) =>
      undated
        ? setUndatedTasks((cur) => upsertUndated(cur ?? [], task))
        : setTasks((cur) => upsertTaskWithRecurrence(cur ?? [], task, loadedMonths));
    const remove = (list: Task[] | undefined) => (list ?? []).filter((t) => t.id !== input.id);
    const restore = () => (undated ? setUndatedTasks(remove) : setTasks(remove));
    apply(optimistic);

    try {
      const { task, error } = await createTask(input);

      // 401: a sessão caiu (aba velha, troca de conta), não a tarefa — espera na fila pelo login.
      if ((error?.offline || error?.status === 401) && userId) {
        enqueue(userId, { op: "create", taskId: input.id, input, at });
        toast.message(undated ? copy.form.createdUndated : copy.form.created, {
          description: copy.task.queued,
        });
        return true;
      }

      if (error || !task) {
        restore();
        toast(copy.form.createError, {
          description: error?.message,
          action: { label: copy.form.upgrade, onClick: () => navigate("/premium") },
        });
        return false;
      }

      apply(task);
      bumpUsage("tasks");
      // Com a etiqueta, o toast de criado vem depois, junto do resultado do Google.
      if (calendar) void pushCalendar([{ id: task.id, ...calendar }]);
      else
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
   * `calendar[i]`: o rascunho `i` vai pro Google Agenda depois de criado.
   */
  const createMany = async (
    list: ParsedTask[],
    calendar: (CalendarPick | undefined)[] = [],
  ): Promise<boolean> => {
    if (limited()) return false;
    setSubmitting(true);
    try {
      const created: Task[] = [];
      for (const parsed of list) {
        const at = Date.now();
        const input = { ...composeTaskInput(parsed, zoned(at)), id: newTaskId(), updatedAt: at };
        const { task, error } = await createTask(input);
        if (!task) {
          toast.error(copy.form.createError, { description: error?.message });
          break;
        }
        created.push(task);
      }
      if (created.length) {
        showCreated(created, copy.mew.createdMany.replace("{n}", String(created.length)));
      }
      const pushes = created.flatMap((task, i) => {
        const pick = calendar[i];
        return pick ? [{ id: task.id, ...pick }] : [];
      });
      if (pushes.length) void pushCalendar(pushes);
      return created.length > 0;
    } finally {
      setSubmitting(false);
    }
  };

  return { create, createMany, submitting };
}
