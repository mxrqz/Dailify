import { useState } from "react";
import { toast } from "sonner";
import { composeTaskInput, type ParsedTask, type Task } from "@dailify/shared";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { createTask, deleteTask, type ApiError } from "@/functions/api";
import { fill, upsertTaskWithRecurrence } from "@/functions/functions";
import { enqueue, newTaskId, shouldQueue } from "@/functions/offline";
import { upsertUndated } from "@/functions/undated";
import { useCalendarPush, type CalendarPick } from "@/hooks/useCalendarPush";
import { zoned } from "@/functions/zone";
import { useSession } from "@/lib/auth";
import { haptic } from "@/lib/haptics";

// The optimistic object itself: the server's reply (or the queued copy) replaces it, which ends it.
const saving = new WeakSet<Task>();
/** Shown but not confirmed yet: the row reads "Salvando…". */
export const isSaving = (task: Task): boolean => saving.has(task);

const queueable = (error: ApiError | undefined, userId: string | undefined): userId is string =>
  shouldQueue(error) && !!userId;

/**
 * Tarefas que já existem no servidor (a voz, os rascunhos da Mew): põe na agenda ou no A qualquer
 * hora e avisa com Desfazer.
 */
export function useShowCreated() {
  const userId = useSession().data?.user.id;
  const { setTasks, setUndatedTasks, loadedMonths } = useDailify();

  // Functional: the reply lands seconds after the tap, so it reads the lists of that moment.
  const put = (list: Task[]) => {
    setTasks((cur) =>
      list
        .filter((t) => !t.undated)
        .reduce((acc, task) => upsertTaskWithRecurrence(acc, task, loadedMonths), cur ?? []),
    );
    setUndatedTasks((cur) => list.filter((t) => t.undated).reduce(upsertUndated, cur ?? []));
  };

  const undo = async (created: Task[]) => {
    const at = Date.now();
    const ids = new Set(created.map((t) => t.id));
    setTasks((cur) => (cur ?? []).filter((t) => !ids.has(t.id)));
    setUndatedTasks((cur) => (cur ?? []).filter((t) => !ids.has(t.id)));
    const results = await Promise.all(created.map((t) => deleteTask(t.id)));

    // A refused delete leaves the task on the server, so it comes back on screen.
    const refused = created.filter((task, i) => {
      const { error } = results[i];
      if (!error) return false;
      if (queueable(error, userId)) {
        enqueue(userId, { op: "delete", taskId: task.id, at });
        return false;
      }
      return true;
    });
    if (!refused.length) return;
    put(refused);
    toast.error(copy.task.deleteError, {
      description: results.find((r) => r.error && !queueable(r.error, userId))?.error?.message,
    });
  };

  return (created: Task[], message: string) => {
    put(created);
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
  const { setTasks, setUndatedTasks, loadedMonths } = useDailify();
  const [submitting, setSubmitting] = useState(false);
  const showCreated = useShowCreated();
  const pushCalendar = useCalendarPush();

  const create = async (
    parsed: ParsedTask,
    {
      undatedOnly,
      calendar,
      before,
    }: { undatedOnly?: boolean; calendar?: CalendarPick; before?: number } = {},
  ): Promise<boolean> => {
    setSubmitting(true);

    // `finally`: qualquer exceção no meio (o parser, a rede) deixava o botão girando
    // pra sempre — o mesmo modo de falha que `protected-route.tsx` já tinha aprendido.
    // O id nasce aqui, não no servidor: sem rede a tarefa precisa existir na tela e na fila com
    // uma identidade estável, e o upsert do servidor aceita o id do cliente sem duplicar.
    const at = Date.now();
    const composed = composeTaskInput(parsed, zoned(at), { undatedOnly });
    // `before` is for the agenda only: an undated task keeps its day reminder.
    const alert =
      before === undefined || composed.undated ? composed.alert : composed.date - before * 60_000;
    const input = { ...composed, alert, id: newTaskId(), updatedAt: at };
    const undated = input.undated === true;
    const optimistic = { ...input, repeatEvery: input.repeatEvery ?? undefined, completed: [] };
    saving.add(optimistic);
    const apply = (task: Task) =>
      undated
        ? setUndatedTasks((cur) => upsertUndated(cur ?? [], task))
        : setTasks((cur) => upsertTaskWithRecurrence(cur ?? [], task, loadedMonths));
    const remove = (list: Task[] | undefined) => (list ?? []).filter((t) => t.id !== input.id);
    const restore = () => (undated ? setUndatedTasks(remove) : setTasks(remove));
    apply(optimistic);
    haptic("success");

    try {
      const { task, error } = await createTask(input);

      if (queueable(error, userId)) {
        enqueue(userId, { op: "create", taskId: input.id, input, at });
        // A fresh object drops "Salvando…": the queue owns it now, and the toast says so.
        apply({ ...optimistic });
        toast.message(undated ? copy.form.createdUndated : copy.form.created, {
          description: copy.task.queued,
        });
        return true;
      }

      if (error || !task) {
        restore();
        toast.error(copy.form.createError, { description: error?.message });
        return false;
      }

      apply(task);
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
        showCreated(created, fill(copy.mew.createdMany, { n: created.length }));
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
