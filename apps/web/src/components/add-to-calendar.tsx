import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { useNavigate } from "react-router-dom";
import { CalendarCheckIcon, CalendarPlusIcon, CalendarSyncIcon } from "lucide-react";
import { toast } from "sonner";
import {
  calendarEventPreview,
  INTEGRATION_ERROR,
  isCalendarEventLink,
  videoLink,
  type ExternalEvent,
} from "@dailify/shared";

import { copy } from "@/components/dashboard/copy";
import { ListGroup, ListRow } from "@/components/kit/list";
import { ConfirmAction } from "@/components/mew/confirm-action";
import { ToolbarButton } from "@/components/task-card";
import { createCalendarEvent, linkCalendarEvent, syncCalendarEvent } from "@/functions/api";
import { appTimeZone } from "@/functions/zone";
import { calendarRevoked, useApplyTask } from "@/hooks/useCalendarPush";
import { tagExternalEvent } from "@/hooks/useExternalEvents";
import { patchIntegration, useCalendarReady, useIntegrations } from "@/hooks/useIntegrations";
import { useOnline } from "@/hooks/useOnline";
import type { TaskProps } from "@/types/types";

const t = copy.calendar;

/**
 * "Adicionar ao Google Agenda": só com a agenda conectada e a tarefa com dia. Já vinculada (o
 * `htmlLink` está nos links) vira "No Google Agenda", que abre o evento; se a última edição não
 * chegou lá (`stale`), ganha o "não sincronizado" e o reenviar.
 */
export function AddToCalendar({
  task,
  variant,
}: {
  task: TaskProps;
  variant: "toolbar" | "sheet";
}): JSX.Element | null {
  const ready = useCalendarReady();
  const staleIds = useIntegrations()?.find((s) => s.provider === "google-calendar")?.stale ?? [];
  const stale = staleIds.includes(task.id);
  const online = useOnline();
  const applyTask = useApplyTask();
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

  const onRevoked = () => calendarRevoked(navigate);

  const retry = async () => {
    setPending(true);
    const token = await getToken().catch(() => null);
    const res = token
      ? await syncCalendarEvent(token, task.id)
      : { error: { message: copy.form.authError, offline: false } };
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
      <ToolbarButton
        label={t.linked}
        onClick={() => window.open(linked, "_blank", "noopener,noreferrer")}
      >
        <CalendarCheckIcon className="size-4" aria-hidden="true" />
      </ToolbarButton>
    ) : (
      <CalendarRows linked={linked} />
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

    const { error } = res;
    // `already_linked` devolve a tarefa como está no servidor: a lista já passa a "No Google Agenda".
    if (res.task && error?.code === INTEGRATION_ERROR.alreadyLinked) {
      applyTask(res.task);
      toast.info(t.alreadyLinked);
      return;
    }
    if (res.task && !error) {
      applyTask(res.task);
      const url = res.link?.url;
      toast.success(t.added, {
        action: url
          ? { label: t.open, onClick: () => window.open(url, "_blank", "noopener,noreferrer") }
          : undefined,
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
          icon={<CalendarCheckIcon />}
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
          icon={<CalendarPlusIcon />}
          label={t.add}
        />
      )}
      {linked && stale && (
        <ListRow onClick={onRetry} disabled={pending} icon={<CalendarSyncIcon />} label={t.retry} />
      )}
    </ListGroup>
  );
}

/**
 * O dedupe (0xp.8): a tarefa parece ser um evento que já está no Google. "Vincular" amarra os dois
 * sem criar outro evento; depois de confirmado o evento some da agenda (ganhou o `mewkiTaskId`).
 */
export function LinkToEvent({
  task,
  event,
}: {
  task: TaskProps;
  event: ExternalEvent;
}): JSX.Element {
  const applyTask = useApplyTask();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const confirm = async () => {
    setPending(true);
    const token = await getToken().catch(() => null);
    const res = token
      ? await linkCalendarEvent(token, task.id, event.id)
      : { error: { message: copy.form.authError, offline: false } };
    setPending(false);
    setOpen(false);

    const { error } = res;
    if (res.task && !error) {
      applyTask(res.task);
      tagExternalEvent(event.id, task.id);
      toast.success(t.linkDone);
    } else if (res.task && error?.code === INTEGRATION_ERROR.alreadyLinked) {
      applyTask(res.task);
      toast.info(t.alreadyLinked);
    } else if (error?.code === INTEGRATION_ERROR.reconnect) {
      calendarRevoked(navigate);
    } else {
      toast.error(t.linkError, { description: error?.message });
    }
  };

  return (
    <>
      <p className="mt-1.5 px-1 text-xs text-muted-foreground">
        {t.looksLinked} ·{" "}
        <button
          type="button"
          className="cursor-pointer text-brand-text underline-offset-2 hover:underline"
          onClick={() => setOpen(true)}
          disabled={pending}
        >
          {t.link}
        </button>
      </p>
      <ConfirmAction
        open={open}
        onOpenChange={setOpen}
        preview={t.linkPreview.replace("{title}", event.title || t.untitled)}
        pending={pending}
        onConfirm={() => void confirm()}
      />
    </>
  );
}
