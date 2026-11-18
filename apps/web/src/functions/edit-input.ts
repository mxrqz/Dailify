import type { TZDate } from "@date-fns/tz";
import { undatedReminder, type Task, type TaskInput } from "@dailify/shared";

import type { TaskFormValues } from "@/components/dashboard/task-form";
import { isTaskModified } from "./functions";

/**
 * O que o formulário de edição grava. Sem horário vai para Sem data: com lembrete às 09:00 do dia
 * escolhido, ou sem lembrete (`date` = agora, só ordena a lista). O alerta da agenda fica com quem
 * chama, que conhece a tarefa original.
 */
export function editTaskInput(values: TaskFormValues, now: TZDate): Partial<TaskInput> {
  const base = {
    title: values.title,
    duration: values.duration,
    priority: values.priority,
    tags: values.tags,
    repeat: values.repeat,
    // `null` e não ausente: o PATCH manteria o intervalo antigo.
    repeatEvery: values.repeat !== "Off" && values.repeatEvery > 1 ? values.repeatEvery : null,
    links: values.links,
  };

  if (!values.undated) return { ...base, date: values.date.getTime(), undated: false };

  const at = values.reminder && undatedReminder(values.reminder, values.repeat, now);
  if (at) return { ...base, date: at.getTime(), alert: at.getTime(), undated: true };
  return { ...base, date: now.getTime(), undated: true };
}

/**
 * The edit sheet's save: the PATCH input, the task as it will show (`updatedAt` = the edit time,
 * LWW) and whether anything changed at all.
 */
export function buildEdit(task: Task, values: TaskFormValues, now: TZDate) {
  const wasUndated = task.undated === true;
  const input = editTaskInput(values, now);
  // An undated task without a reminder keeps its `date` (the list order): saving doesn't sink it.
  const date = values.undated && !input.alert && wasUndated ? task.date : (input.date ?? task.date);
  // Agenda: the alert follows the task; the undated 09:00 reminder doesn't apply there.
  const alert = values.undated ? input.alert : wasUndated ? date : (task.alert ?? date);
  const taskData = {
    ...task,
    ...input,
    repeatEvery: input.repeatEvery ?? undefined,
    date,
    alert,
    updatedAt: now.getTime(),
  };
  // `isTaskModified` compares `alert ?? date`: clearing an undated reminder (date === alert) would
  // read as unchanged.
  const unchanged =
    !isTaskModified(task, taskData) &&
    wasUndated === values.undated &&
    (!values.undated || task.alert === alert);
  return { input, taskData, unchanged };
}
