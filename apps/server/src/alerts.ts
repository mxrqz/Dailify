import type { Env } from "./index";
import {
  deleteSubscriptionByEndpoint,
  dueAlerts,
  markAlertsSent,
  subscriptionsFor,
} from "./db/push";
import { sendPush } from "./lib/push";

// O cron roda a cada 5 min; a folga cobre uma passada perdida sem despejar lembrete de ontem.
const GRACE_MS = 60 * 60 * 1000;

/**
 * Uma passada do Cron Trigger: manda os alertas vencidos e marca o que saiu. Marca também quando o
 * usuário não tem device inscrito — senão a mesma tarefa seria reprocessada a cada 5 minutos para
 * sempre.
 */
export async function dispatchAlerts(env: Env, now: number = Date.now()): Promise<number> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return 0;

  const due = await dueAlerts(env.DB, now, GRACE_MS);
  if (!due.length) return 0;

  const subscriptions = await subscriptionsFor(env.DB, [...new Set(due.map((d) => d.userId))]);
  let sent = 0;

  for (const task of due) {
    for (const subscription of subscriptions.get(task.userId) ?? []) {
      const status = await sendPush(env, subscription, {
        taskId: task.id,
        title: task.title,
        at: task.date,
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
    due.map((t) => t.id),
    now,
  );
  return sent;
}
