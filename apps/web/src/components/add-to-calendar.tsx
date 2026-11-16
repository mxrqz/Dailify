import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { CalendarCheckIcon, CalendarPlusIcon } from "lucide-react";
import { toast } from "sonner";
import {
  calendarEventPreview,
  INTEGRATION_ERROR,
  isCalendarEventLink,
  videoLink,
} from "@dailify/shared";

import { useDailify } from "@/components/dailifyContext";
import { copy } from "@/components/dashboard/copy";
import { ConfirmAction } from "@/components/mew/confirm-action";
import { ToolbarButton } from "@/components/task-card";
import { createCalendarEvent } from "@/functions/api";
import { upsertTaskWithRecurrence } from "@/functions/functions";
import { upsertUndated } from "@/functions/undated";
import { appTimeZone } from "@/functions/zone";
import { patchIntegration, useCalendarReady } from "@/hooks/useIntegrations";
import { useOnline } from "@/hooks/useOnline";
import type { TaskProps } from "@/types/types";

const t = copy.calendar;
const sheetAction =
  "flex h-12 cursor-pointer items-center justify-center gap-2 rounded-field bg-surface-hover text-sm transition-colors hover:bg-surface-line";

/**
 * "Adicionar ao Google Agenda": só com a agenda conectada e a tarefa com dia. Já vinculada (o
 * `htmlLink` está nos links) vira "No Google Agenda", que abre o evento.
 */
export function AddToCalendar({
  task,
  variant,
}: {
  task: TaskProps;
  variant: "toolbar" | "sheet";
}): JSX.Element | null {
  const ready = useCalendarReady();
  const online = useOnline();
  const { tasks, setTasks, undatedTasks, setUndatedTasks, loadedMonths } = useDailify();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [meet, setMeet] = useState(false);
  const [pending, setPending] = useState(false);

  const hasVideo = Boolean(videoLink(task.links));
  const preview = calendarEventPreview(task, appTimeZone(), {
    meet: meet && !hasVideo,
    now: Date.now(),
  });
  const linked = task.links?.find(isCalendarEventLink);
  if (!ready || !preview) return null;

  if (linked) {
    return variant === "toolbar" ? (
      <ToolbarButton
        label={t.linked}
        onClick={() => window.open(linked, "_blank", "noopener,noreferrer")}
      >
        <CalendarCheckIcon className="size-4" aria-hidden="true" />
      </ToolbarButton>
    ) : (
      <a href={linked} target="_blank" rel="noreferrer" className={sheetAction}>
        <CalendarCheckIcon className="size-5" aria-hidden="true" />
        {t.linked}
      </a>
    );
  }
  if (!online) return null;

  const confirm = async () => {
    setPending(true);
    const token = await getToken().catch(() => null);
    const res = token
      ? await createCalendarEvent(token, task.id, meet && !hasVideo)
      : { error: { message: copy.form.authError, offline: false } };
    setPending(false);
    setOpen(false);

    if ("task" in res && res.task) {
      const updated = res.task;
      if (updated.undated) setUndatedTasks(upsertUndated(undatedTasks ?? [], updated));
      else setTasks(upsertTaskWithRecurrence(tasks ?? [], updated, loadedMonths));
      const url = res.link?.url;
      toast.success(t.added, {
        action: url
          ? { label: t.open, onClick: () => window.open(url, "_blank", "noopener,noreferrer") }
          : undefined,
      });
      return;
    }

    const { error } = res;
    if (error?.code === INTEGRATION_ERROR.reconnect) {
      patchIntegration("google-calendar", { status: "revoked" });
      toast.error(t.revoked, {
        action: { label: t.reconnect, onClick: () => navigate("/settings") },
      });
    } else if (error?.code === INTEGRATION_ERROR.alreadyLinked) {
      toast.info(t.alreadyLinked);
    } else {
      toast.error(t.error, { description: error?.message });
    }
  };

  return (
    <>
      {variant === "toolbar" ? (
        <ToolbarButton label={t.add} onClick={() => setOpen(true)} disabled={pending}>
          <CalendarPlusIcon className="size-4" aria-hidden="true" />
        </ToolbarButton>
      ) : (
        <button
          type="button"
          className={sheetAction}
          onClick={() => setOpen(true)}
          disabled={pending}
        >
          <CalendarPlusIcon className="size-5" aria-hidden="true" />
          {t.add}
        </button>
      )}
      <ConfirmAction
        open={open}
        onOpenChange={setOpen}
        preview={preview}
        option={hasVideo ? undefined : { label: t.meet, checked: meet, onChange: setMeet }}
        pending={pending}
        onConfirm={() => void confirm()}
      />
    </>
  );
}
