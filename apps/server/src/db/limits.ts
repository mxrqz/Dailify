import { PLAN_PERMISSIONS, type Task } from "@dailify/shared";
import type { Env } from "../index";
import { getUserRole } from "../lib/clerk";
import { countMonthlyTasks, countRecurringTasks } from "./tasks";

export async function enforceCreate(env: Env, userId: string, task: Task): Promise<string | null> {
  const perms = PLAN_PERMISSIONS[await getUserRole(env, userId)];
  const isRecurring = task.repeat !== "Off";
  if (isRecurring && perms.taskLimits.recurring !== -1) {
    const n = await countRecurringTasks(env.DB, userId);
    if (n >= perms.taskLimits.recurring) return "Recurring Tasks Limit Reached";
  }
  if (perms.taskLimits.monthly !== -1) {
    const n = await countMonthlyTasks(env.DB, userId, new Date(task.date));
    if (n >= perms.taskLimits.monthly) return "Monthly Tasks Limit Reached";
  }
  return null;
}
