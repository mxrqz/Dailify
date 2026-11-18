import { useState } from "react";
import { isSameDay } from "date-fns";
import { toast } from "sonner";

import { useDailify } from "@/components/dailifyContext";
import { useSession } from "@/lib/auth";
import { haptic } from "@/lib/haptics";
import { copy } from "@/components/dashboard/copy";
import { RecurrenceScopeDialog } from "@/components/dashboard/recurrence-scope-dialog";
import { ActionSheet } from "@/components/kit/action-sheet";
import { completeTask, createTask, deleteTask, uncompleteTask, updateTask } from "@/functions/api";
import type { ApiError } from "@/functions/api";
import { fill, upsertTaskWithRecurrence } from "@/functions/functions";
import { revertTask } from "@/functions/revert-task";
import { enqueue, shouldQueue, type Mutation } from "@/functions/offline";
import { isCalendarEventLink, seriesOf, type TaskInput } from "@dailify/shared";
import type { TaskProps } from "@/types/types";
import { zoned } from "@/functions/zone";

/**
 * Concluir/reabrir/editar/excluir — compartilhado pelo menu (⋮) do cartão e pela folha de edição.
 *
 * As escritas são otimistas e o erro tem dois desfechos: falha de REDE mantém o que está na tela e
 * guarda a mutação na fila (é o que faz o app funcionar sem conexão); falha de SERVIDOR desfaz,
 * porque aí a recusa é definitiva.
 */
export function useTaskActions(
  task: TaskProps,
  day: Date = zoned(),
  { onDeleted }: { onDeleted?: () => void } = {},
) {
  const { tasks, setTasks, loadedMonths } = useDailify();
  const userId = useSession().data?.user.id;
  const [scopeOpen, setScopeOpen] = useState(false);
  // Ligada à Agenda: excluir apaga o evento lá também, e não há desfazer que o traga de volta.
  const linked = task.links?.some(isCalendarEventLink) ?? false;
  const [confirmOpen, setConfirmOpen] = useState(false);

  const rollback = (previous: TaskProps[]) =>
    setTasks((cur) => revertTask(cur ?? [], previous, task.id));

  const settle = (
    error: ApiError | undefined,
    previous: TaskProps[],
    mutation: Mutation,
    message: string,
  ): boolean => {
    if (!error) return true;

    if (shouldQueue(error) && userId) {
      enqueue(userId, mutation);
      return true;
    }

    rollback(previous);
    toast.error(message, { description: error.message });
    return false;
  };

  const onComplete = async () => {
    const at = Date.now();
    // Completion is read per day (`getCompletionDate`): another day's card stamps its own date.
    const stamp = isSameDay(day, zoned(at)) ? at : task.date;
    const previous = tasks ?? [];
    const done: TaskProps = { ...task, completed: [...task.completed, stamp], updatedAt: at };
    setTasks((cur) => upsertTaskWithRecurrence(cur ?? [], done, loadedMonths));
    haptic("success");

    const mutation: Mutation = { op: "complete", taskId: task.id, at: stamp };
    const { error } = await completeTask(task.id, stamp);
    settle(error, previous, mutation, copy.task.completeError);
  };

  /** Reabre a ocorrência DESTE dia: a recorrente é concluída por ocorrência, não de uma vez. */
  const onUncomplete = async () => {
    const at = Date.now();
    const previous = tasks ?? [];
    const from = zoned(day).setHours(0, 0, 0, 0);
    const to = zoned(day).setHours(23, 59, 59, 999);
    const reopened: TaskProps = {
      ...task,
      completed: task.completed.filter((done) => done < from || done > to),
      updatedAt: at,
    };
    setTasks((cur) => upsertTaskWithRecurrence(cur ?? [], reopened, loadedMonths));

    const mutation: Mutation = { op: "uncomplete", taskId: task.id, day: from, at };
    const { error } = await uncompleteTask(task.id, day);
    settle(error, previous, mutation, copy.task.uncompleteError);
  };

  /** Re-creates the task with the SAME id, a series from its anchor, not the tapped occurrence. */
  const restore = async () => {
    const at = Date.now();
    // ponytail: the server drops `completed` (and `exdates`) on create, so Undo restores the task
    // without its history; re-sending them needs a create that accepts both.
    const input = { ...seriesOf(task), completed: [], exdates: undefined, updatedAt: at };
    setTasks((cur) => upsertTaskWithRecurrence(cur ?? [], input, loadedMonths));

    const mutation: Mutation = { op: "create", taskId: task.id, input, at };
    const { error } = await createTask(input);
    if (settle(error, [], mutation, copy.task.undoError)) toast.success(copy.task.restored);
  };

  const removeSeries = async () => {
    const at = Date.now();
    const previous = tasks ?? [];
    setTasks((cur) => (cur ?? []).filter((t) => t.id !== task.id));

    const mutation: Mutation = { op: "delete", taskId: task.id, at };
    // Um 500 aqui não pode passar por sucesso: antes o cartão sumia da tela com a tarefa viva.
    const { error } = await deleteTask(task.id);
    if (!settle(error, previous, mutation, copy.task.deleteError)) return;
    onDeleted?.();

    if (linked) {
      toast.success(copy.task.deleted, { description: task.title });
      return;
    }
    // Desfazer no lugar de um diálogo de confirmação: não cobra um toque a mais das exclusões
    // certas, e cobre a errada.
    toast.success(copy.task.deleted, {
      description: task.title,
      duration: 6000,
      action: { label: copy.task.undo, onClick: () => void restore() },
    });
  };

  /**
   * Exclui só a ocorrência deste dia: a série continua inteira e a data entra no `exdates` dela.
   * Sem "Desfazer" — reverter seria tirar a data do `exdates`, e não há rota pra isso; recriar a
   * tarefa (o que o `restore` faz) devolveria uma cópia solta no lugar da ocorrência.
   */
  const removeOccurrence = async () => {
    const at = Date.now();
    const previous = tasks ?? [];
    setTasks((cur) => (cur ?? []).filter((t) => !(t.id === task.id && t.date === task.date)));

    const mutation: Mutation = {
      op: "delete-occurrence",
      taskId: task.id,
      occurrence: task.date,
      at,
    };
    const { series, error } = await deleteTask(task.id, task.date);
    if (!settle(error, previous, mutation, copy.task.deleteError)) return;
    // Reexpandir a série com o `exdates` novo é mais fiel que o filtro otimista acima: é o servidor
    // dizendo quais dias sobraram.
    if (series) setTasks((cur) => upsertTaskWithRecurrence(cur ?? [], series, loadedMonths));
    onDeleted?.();
    toast.success(copy.task.occurrenceDeleted, { description: task.title });
  };

  /** Recorrente pergunta o escopo antes; ligada à Agenda confirma; o resto apaga direto. */
  const onDelete = async () => {
    if (task.repeat !== "Off") setScopeOpen(true);
    else if (linked) setConfirmOpen(true);
    else await removeSeries();
  };

  // Renderizado por quem usa o hook: os três pontos que excluem (menu ⋮, swipe e folha de edição)
  // precisam do diálogo, e duplicar a UI em cada um é que seria o erro.
  const deleteDialog = (
    <>
      <RecurrenceScopeDialog
        open={scopeOpen}
        onOpenChange={setScopeOpen}
        description={copy.form.scopeDeleteDescription}
        destructive
        onOccurrence={() => {
          setScopeOpen(false);
          void removeOccurrence();
        }}
        onSeries={() => {
          setScopeOpen(false);
          if (linked) setConfirmOpen(true);
          else void removeSeries();
        }}
      />
      <ActionSheet
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={fill(copy.calendar.deleteTitle, { title: task.title })}
        description={task.repeat === "Off" ? undefined : copy.calendar.deleteSeries}
        actions={[
          {
            label: copy.calendar.deleteConfirm,
            destructive: true,
            onSelect: () => void removeSeries(),
          },
        ]}
      />
    </>
  );

  /**
   * Edição campo a campo pelo cartão (título, duração, prioridade, recorrência, links). Devolve
   * `false` pra quem chamou desfazer o que já mostrou na tela.
   */
  const onPatch = async (patch: Partial<TaskInput>, occurrence?: number): Promise<boolean> => {
    const at = Date.now();
    const previous = tasks ?? [];
    const wholeSeries = occurrence === undefined;
    const stamped = { ...patch, updatedAt: at };
    // A series move shifts the anchor; the tapped occurrence's date would re-anchor it there.
    if (wholeSeries && patch.date !== undefined)
      stamped.date = seriesOf(task).date + patch.date - task.date;
    // `repeatEvery: null` é "volta a 1" no fio; na tarefa da tela é ausência.
    const repeatEvery =
      patch.repeatEvery === undefined ? task.repeatEvery : (patch.repeatEvery ?? undefined);
    const local = { ...stamped, repeatEvery };
    // Só esta ocorrência: mexe só na instância da tela; a série inteira fica como está.
    setTasks((cur = []) =>
      wholeSeries
        ? upsertTaskWithRecurrence(cur, { ...seriesOf(task), ...local }, loadedMonths)
        : cur.map((t) => (t.id === task.id && t.date === occurrence ? { ...t, ...local } : t)),
    );

    const mutation: Mutation = { op: "patch", taskId: task.id, patch: stamped, at, occurrence };
    const { task: updated, series, error } = await updateTask(task.id, stamped, occurrence);
    if (!settle(error, previous, mutation, copy.task.patchError)) return false;
    if (!updated) return true; // foi pra fila: o que está na tela já é o estado bom

    // A resposta do servidor ainda entra: ela traz o que o patch não mandou (recorrência expandida).
    // A série vem primeiro: reexpandi-la tira a ocorrência que virou tarefa própria (`exdates`).
    setTasks((cur = []) =>
      upsertTaskWithRecurrence(
        series ? upsertTaskWithRecurrence(cur, series, loadedMonths) : cur,
        updated,
        loadedMonths,
      ),
    );
    return true;
  };

  return {
    onComplete,
    onUncomplete,
    onDelete,
    deleteDialog,
    onPatch,
    onRename: (title: string) => onPatch({ title }),
  };
}
