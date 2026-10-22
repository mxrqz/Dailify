import type { TaskInput } from "@dailify/shared";

import type { TaskFormValues } from "@/components/dashboard/task-form";
import { undatedReminder } from "./compose-input";

/**
 * O que o formulário de edição grava. Sem horário vai para Sem data: com lembrete às 09:00 do dia
 * escolhido, ou sem lembrete (`date` = agora, só ordena a lista). O alerta da agenda fica com quem
 * chama, que conhece a tarefa original.
 */
export function editTaskInput(values: TaskFormValues, now: Date): Partial<TaskInput> {
  const base = {
    title: values.title,
    duration: values.duration,
    priority: values.priority,
    tags: values.tags,
    repeat: values.repeat,
    links: values.links,
  };

  if (!values.undated) return { ...base, date: values.date.getTime(), undated: false };

  const at = values.reminder && undatedReminder(values.reminder, values.repeat, now);
  if (at) return { ...base, date: at.getTime(), alert: at.getTime(), undated: true };
  return { ...base, date: now.getTime(), undated: true };
}
