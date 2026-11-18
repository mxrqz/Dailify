import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarCheckIcon, CalendarPlusIcon, CalendarSyncIcon } from "lucide-react";
import { toast } from "sonner";
import {
  calendarEventPreview,
  INTEGRATION_ERROR,
  isCalendarEventLink,
  videoLink,
} from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { ListGroup, ListRow } from "@/components/kit/list";
import { ConfirmAction } from "@/components/mew/confirm-action";
import { CalendarBadge } from "@/components/logos";
import { ToolbarButton } from "@/components/task-card";
import { createCalendarEvent, syncCalendarEvent } from "@/functions/api";
import { appTimeZone } from "@/functions/zone";
import { calendarRevoked, useApplyTask } from "@/hooks/useCalendarPush";
import { patchIntegration, useCalendarReady, useIntegrations } from "@/hooks/useIntegrations";
import { useOnline } from "@/hooks/useOnline";
import { openExternal } from "@/lib/open-external";
import type { Task } from "@dailify/shared";

const t = copy.calendar;

/**
 * "Adicionar à Agenda": só com a agenda conectada e a tarefa com dia. Já vinculada (o
 * `htmlLink` está nos links) vira "Na Agenda", que abre o evento; se a última edição não
 * chegou lá (`stale`), ganha o "não sincronizado" e o reenviar.
 */
export function AddToCalendar({
  task,
  variant,
}: {
  task: Task;
  variant: "toolbar" | "sheet";
}): JSX.Element | null {
  const ready = useCalendarReady();
  const staleIds = useIntegrations()?.find((s) => s.provider === "google-calendar")?.stale ?? [];
  const stale = staleIds.includes(task.id);
  const online = useOnline();
  const applyTask = useApplyTask();
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

  const onRevoked = () => calendarRevoked(navigate);

  const retry = async () => {
    setPending(true);
    const res = await syncCalendarEvent(task.id);
    setPending(false);
    if (!res.error) {
      patchIntegration("google-calendar", { stale: staleIds.filter((id) => id !== task.id) });
      if (res.task) applyTask(res.task);
      toast.success(t.synced);
    } else if (res.error.code === INTEGRATION_ERROR.reconnect) onRevoked();
    else toast.error(t.syncError, { description: res.error.message });
  };

  if (linked && stale && online) {
    return variant === "toolbar" ? (
      <ToolbarButton label={t.retry} onClick={() => void retry()} disabled={pending}>
        <CalendarSyncIcon className="size-4" aria-hidden="true" />
      </ToolbarButton>
    ) : (
      <CalendarRows linked={linked} stale pending={pending} onRetry={() => void retry()} />
    );
  }
  if (linked) {
    return variant === "toolbar" ? (
      <ToolbarButton label={t.linked} onClick={() => void openExternal(linked, true)}>
        <CalendarCheckIcon className="size-4" aria-hidden="true" />
      </ToolbarButton>
    ) : (
      <CalendarRows linked={linked} />
    );
  }
  if (!online) return null;

  const confirm = async () => {
    setPending(true);
    const res = await createCalendarEvent(task.id, meet && !hasVideo);
    setPending(false);
    setOpen(false);

    const { error } = res;
    // `already_linked` devolve a tarefa como está no servidor: a lista já passa a "Na Agenda".
    if (res.task && error?.code === INTEGRATION_ERROR.alreadyLinked) {
      applyTask(res.task);
      toast.info(t.alreadyLinked);
      return;
    }
    if (res.task && !error) {
      applyTask(res.task);
      const url = res.link?.url;
      toast.success(t.added, {
        action: url ? { label: t.open, onClick: () => void openExternal(url, true) } : undefined,
      });
      return;
    }

    if (error?.code === INTEGRATION_ERROR.reconnect) {
      onRevoked();
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
        <CalendarRows pending={pending} onAdd={() => setOpen(true)} />
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

/**
 * O grupo do Google Agenda na tarefa aberta, só markup: vinculada abre o evento ("· não
 * sincronizado" + reenviar quando a última edição não chegou lá); sem vínculo, oferece adicionar.
 */
export function CalendarRows({
  linked,
  stale,
  pending,
  onAdd,
  onRetry,
}: {
  linked?: string;
  stale?: boolean;
  pending?: boolean;
  onAdd?: () => void;
  onRetry?: () => void;
}): JSX.Element {
  return (
    <ListGroup compact>
      {linked ? (
        <ListRow
          href={linked}
          accessory="external"
          icon={<CalendarBadge />}
          label={t.linked}
          sublabel={stale && t.unsynced}
          value={t.open}
          aria-label={stale ? `${t.linked} · ${t.unsynced}` : t.linked}
        />
      ) : (
        <ListRow
          onClick={onAdd}
          disabled={pending}
          accessory="chevron"
          icon={<CalendarBadge />}
          label={t.add}
        />
      )}
      {linked && stale && (
        <ListRow onClick={onRetry} disabled={pending} icon={<CalendarSyncIcon />} label={t.retry} />
      )}
    </ListGroup>
  );
}
