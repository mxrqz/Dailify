import { toast } from "sonner";
import type { Task } from "@dailify/shared";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { createTask, deleteTask, setMewAction, updateTask } from "@/functions/api";
import { upsertTaskWithRecurrence } from "@/functions/functions";
import { upsertUndated } from "@/functions/undated";
import { useCalendarPush } from "@/hooks/useCalendarPush";

import type { ConfirmBlock } from "./thread";

interface Lists {
  tasks: Task[];
  undated: Task[];
}

/** Turning `out` into `into` on the server: same id = update, otherwise create or delete. */
export function writes(out: Task[], into: Task[]) {
  const was = new Set(out.map((t) => t.id));
  const stays = new Set(into.map((t) => t.id));
  return {
    create: into.filter((t) => !was.has(t.id)),
    update: into.filter((t) => was.has(t.id)),
    remove: out.filter((t) => !stays.has(t.id)),
  };
}

/** The same swap on the screen: the agenda and the "A qualquer hora" list. */
export function swap(lists: Lists, out: Task[], into: Task[], months: Date[]): Lists {
  const gone = new Set(out.map((t) => t.id));
  return {
    tasks: into
      .filter((t) => !t.undated)
      .reduce(
        (list, t) => upsertTaskWithRecurrence(list, t, months),
        lists.tasks.filter((t) => !gone.has(t.id)),
      ),
    undated: into
      .filter((t) => t.undated)
      .reduce(
        upsertUndated,
        lists.undated.filter((t) => !gone.has(t.id)),
      ),
  };
}

/**
 * Confirm (`do`: before → after) or undo (after → before) a Mew box against the real task state.
 * Optimistic; any refused write rolls the screen back and returns `false`.
 */
export function useMewApply() {
  const { setTasks, setUndatedTasks, loadedMonths, bumpUsage } = useDailify();
  const pushCalendar = useCalendarPush();

  // Functional: the writes take a round-trip, and whatever landed meanwhile must survive.
  // `swap` reads each list only for its own half, so one empty side is safe.
  const show = (out: Task[], into: Task[]) => {
    setTasks((tasks) => swap({ tasks: tasks ?? [], undated: [] }, out, into, loadedMonths).tasks);
    setUndatedTasks(
      (undated) => swap({ tasks: [], undated: undated ?? [] }, out, into, loadedMonths).undated,
    );
  };

  return async (block: ConfirmBlock, way: "do" | "undo"): Promise<boolean> => {
    const [out, into] = way === "do" ? [block.before, block.after] : [block.after, block.before];
    show(out, into);

    const at = Date.now();
    const plan = writes(out, into);
    const results = await Promise.all([
      ...plan.create.map((t) => createTask({ ...t, updatedAt: at })),
      ...plan.update.map((t) =>
        updateTask(t.id, { title: t.title, date: t.date, alert: t.alert ?? null, updatedAt: at }),
      ),
      ...plan.remove.map((t) => deleteTask(t.id)),
    ]);
    const error = results.find((r) => r.error)?.error;
    if (error) {
      // ponytail: a partial failure rolls back writes that did land too (until the next reload);
      // a batch route applying a box atomically would fix it.
      show(into, out);
      toast.error(copy.mewChat.applyError, { description: error.message });
      return false;
    }

    plan.create.forEach(() => bumpUsage("tasks"));
    void setMewAction(block.id, way === "do" ? "done" : "undone");
    const calendar = block.targets?.find((x) => x.provider === "google-calendar");
    if (way === "do" && calendar)
      void pushCalendar(plan.create.map((t) => ({ id: t.id, meet: calendar.meet ?? false })));
    return true;
  };
}
