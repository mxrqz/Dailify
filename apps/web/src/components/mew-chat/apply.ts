import { toast } from "sonner";
import type { Task } from "@dailify/shared";

import { useDailify } from "@/components/dailifyContext";
import { createTask, deleteTask, setMewAction, updateTask } from "@/functions/api";
import { swapTasks, swapUndated } from "@/functions/task-lists";
import { useCalendarPush } from "@/hooks/useCalendarPush";

import { copy } from "./copy";
import type { ConfirmBlock } from "./thread";

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

/**
 * Confirm (`do`: before → after) or undo (after → before) a Mew box against the real task state.
 * Optimistic; any refused write rolls the screen back and returns `false`.
 */
export function useMewApply() {
  const { setTasks, setUndatedTasks, loadedMonths, bumpUsage } = useDailify();
  const pushCalendar = useCalendarPush();

  // Functional: the writes take a round-trip, and whatever landed meanwhile must survive.
  const show = (out: Task[], into: Task[]) => {
    const gone = out.map((t) => t.id);
    setTasks((tasks) => swapTasks(tasks ?? [], gone, into, loadedMonths));
    setUndatedTasks((undated) => swapUndated(undated ?? [], gone, into));
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
      toast.error(copy.applyError, { description: error.message });
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
