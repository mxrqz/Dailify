import { useNavigate, type NavigateFunction } from "react-router-dom";
import { toast } from "sonner";
import { INTEGRATION_ERROR } from "@dailify/shared";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { createCalendarEvent } from "@/functions/api";
import { fill, upsertTaskWithRecurrence } from "@/functions/functions";
import { upsertUndated } from "@/functions/undated";
import { patchIntegration } from "@/hooks/useIntegrations";
import type { TaskProps } from "@/types/types";

const t = copy.calendar;

/**
 * Põe a tarefa que o servidor devolveu (agora com o `htmlLink`) na agenda ou no A qualquer hora.
 * Lê as listas de agora, não as do render: a resposta do Google chega depois, e várias seguidas
 * não podem apagar uma à outra.
 */
export function useApplyTask(): (task: TaskProps) => void {
  const { setTasks, setUndatedTasks, loadedMonths } = useDailify();

  return (task) =>
    task.undated
      ? setUndatedTasks((cur) => upsertUndated(cur ?? [], task))
      : setTasks((cur) => upsertTaskWithRecurrence(cur ?? [], task, loadedMonths));
}

/** O 409 `reconnect`: a agenda some das ofertas e o toast leva pra reconectar. */
export function calendarRevoked(navigate: NavigateFunction): void {
  patchIntegration("google-calendar", { status: "revoked" });
  toast.error(t.revoked, { action: { label: t.reconnect, onClick: () => navigate("/settings") } });
}

export interface CalendarPick {
  meet: boolean;
}

/**
 * Tarefas recém-criadas com a etiqueta Google Agenda ligada no composer. A tarefa já existe: falhar
 * aqui não a desfaz, só oferece tentar de novo — com as que falharam, num toast só.
 */
export function useCalendarPush(): (items: (CalendarPick & { id: string })[]) => Promise<void> {
  const navigate = useNavigate();
  const apply = useApplyTask();

  const push = async (items: (CalendarPick & { id: string })[]): Promise<void> => {
    const results = await Promise.all(items.map((item) => createCalendarEvent(item.id, item.meet)));
    const failed = items.filter((_, i) => {
      const { task, error } = results[i];
      if (!task || (error && error.code !== INTEGRATION_ERROR.alreadyLinked)) return true;
      apply(task);
      return false;
    });

    if (results.some((r) => r.error?.code === INTEGRATION_ERROR.reconnect)) {
      calendarRevoked(navigate);
    } else if (!failed.length) {
      toast.success(
        items.length === 1 ? t.createdAdded : fill(t.createdAddedMany, { n: items.length }),
      );
    } else {
      toast.error(failed.length === 1 ? t.notAdded : fill(t.notAddedMany, { n: failed.length }), {
        description: items.length === 1 ? results[0].error?.message : undefined,
        action: { label: t.tryAgain, onClick: () => void push(failed) },
      });
    }
  };

  return push;
}
