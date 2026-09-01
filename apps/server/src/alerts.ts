import type { Env } from "./index";
import {
  deleteSubscriptionByEndpoint,
  dueAlerts,
  markAlertsSent,
  markOccurrenceAlerted,
  recurringAlertCandidates,
  subscriptionsFor,
  type DueAlert,
} from "./db/push";
import { dueOccurrenceAlert } from "./lib/occurrence-alert";
import { sendPush } from "./lib/push";

// O cron roda a cada 5 min; a folga cobre uma passada perdida sem despejar lembrete de ontem.
const GRACE_MS = 60 * 60 * 1000;

interface Outgoing {
  taskId: string;
  userId: string;
  title: string;
  /** Instante da tarefa (o que a notificação mostra), não o do alerta. */
  at: number;
}

/**
 * Uma passada do Cron Trigger: manda os alertas vencidos e marca o que saiu. Marca também quando o
 * usuário não tem device inscrito — senão a mesma tarefa seria reprocessada a cada 5 minutos para
 * sempre.
 */
export async function dispatchAlerts(env: Env, now: number = Date.now()): Promise<number> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return 0;

  const single = await dueAlerts(env.DB, now, GRACE_MS);
  const recurring = await dueRecurring(env, now);
  const outgoing = [...single.map(toOutgoing), ...recurring.map((r) => r.outgoing)];
  if (!outgoing.length) return 0;

  const subscriptions = await subscriptionsFor(env.DB, [
    ...new Set(outgoing.map((o) => o.userId)),
  ]);
  let sent = 0;

  for (const alert of outgoing) {
    for (const subscription of subscriptions.get(alert.userId) ?? []) {
      const status = await sendPush(env, subscription, {
        taskId: alert.taskId,
        title: alert.title,
        at: alert.at,
      });
      if (status === 404 || status === 410) {
        await deleteSubscriptionByEndpoint(env.DB, subscription.endpoint);
      } else if (status < 300) {
        sent++;
      }
    }
  }

  await markAlertsSent(
    env.DB,
    single.map((t) => t.id),
    now,
  );
  // A série guarda até QUAL ocorrência foi avisada, não a hora do envio — a próxima ainda vem.
  for (const { taskId, alertAt } of recurring) {
    await markOccurrenceAlerted(env.DB, taskId, alertAt);
  }
  return sent;
}

const toOutgoing = (t: DueAlert): Outgoing => ({
  taskId: t.id,
  userId: t.userId,
  title: t.title,
  at: t.date,
});

/** Ocorrências de séries cujo alerta venceu nesta janela (bd Dailify-bv7). */
async function dueRecurring(
  env: Env,
  now: number,
): Promise<{ taskId: string; alertAt: number; outgoing: Outgoing }[]> {
  const candidates = await recurringAlertCandidates(env.DB);
  const out: { taskId: string; alertAt: number; outgoing: Outgoing }[] = [];

  for (const { task, userId, alertSent, timeZone } of candidates) {
    const alertAt = dueOccurrenceAlert(task, alertSent, timeZone, now, GRACE_MS);
    if (alertAt === null) continue;

    const offset = (task.alert ?? task.date) - task.date;
    out.push({
      taskId: task.id,
      alertAt,
      outgoing: { taskId: task.id, userId, title: task.title, at: alertAt - offset },
    });
  }
  return out;
}
