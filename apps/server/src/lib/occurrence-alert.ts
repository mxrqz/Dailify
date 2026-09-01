import { expandRecurringTask, zonedParts, type Task } from "@dailify/shared";

/**
 * Qual alerta de uma série está vencido agora, se algum.
 *
 * O alerta de cada ocorrência guarda a MESMA distância que o alerta original guarda da data
 * original (`alert - date`): "avise 10 min antes" continua sendo 10 min antes em toda ocorrência.
 *
 * Devolve o instante do alerta a disparar — nunca uma lista: se o cron ficou parado e três
 * ocorrências venceram, o usuário quer o lembrete da mais recente, não três notificações.
 */
export function dueOccurrenceAlert(
  task: Task,
  alertSent: number | null,
  timeZone: string,
  now: number,
  graceMs: number,
): number | null {
  if (task.alert === undefined) return null;
  const offset = task.alert - task.date;
  const floor = Math.max(now - graceMs, alertSent ?? 0);

  const candidates: number[] = [];
  for (const month of monthsTouching(now, graceMs, timeZone)) {
    // A ocorrência original não sai da expansão (ela é a própria linha guardada), então entra à mão.
    for (const instance of [task, ...expandRecurringTask(task, month, timeZone)]) {
      const alertAt = instance.date + offset;
      if (alertAt > floor && alertAt <= now) candidates.push(alertAt);
    }
  }

  return candidates.length ? Math.max(...candidates) : null;
}

/**
 * Os meses que a janela toca, no fuso do usuário. São dois só quando a janela cruza a virada do
 * mês — e é justamente aí que olhar um mês só perderia a ocorrência.
 */
function monthsTouching(now: number, graceMs: number, timeZone: string): Date[] {
  const end = zonedParts(now, timeZone);
  const start = zonedParts(now - graceMs, timeZone);
  const months = [new Date(end.year, end.month, 1)];
  if (start.year !== end.year || start.month !== end.month) {
    months.push(new Date(start.year, start.month, 1));
  }
  return months;
}
