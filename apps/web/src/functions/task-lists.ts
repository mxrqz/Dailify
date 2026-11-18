import type { Task } from "@dailify/shared";

import { upsertTaskWithRecurrence } from "./functions";
import { upsertUndated } from "./undated";

// One function per list, so each `setTasks`/`setUndatedTasks` can apply it as a functional update.

/** The agenda without the `gone` ids, plus the dated tasks of `into` expanded over `months`. */
export const swapTasks = (tasks: Task[], gone: string[], into: Task[], months: Date[]): Task[] =>
  into
    .filter((t) => !t.undated)
    .reduce(
      (list, t) => upsertTaskWithRecurrence(list, t, months),
      tasks.filter((t) => !gone.includes(t.id)),
    );

/** The undated list without the `gone` ids, plus the undated tasks of `into`. */
export const swapUndated = (undated: Task[], gone: string[], into: Task[]): Task[] =>
  into
    .filter((t) => t.undated)
    .reduce(
      (list, t) => upsertUndated(list, t),
      undated.filter((t) => !gone.includes(t.id)),
    );
