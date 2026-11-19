import { useEffect, useState } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { copy } from "@/components/dashboard/copy";
import { ListRow } from "@/components/kit/list";
import { Switch } from "@/components/kit/switch";
import { disablePush, enablePush, pushState, type PushState } from "@/functions/push";
import { nativeReminders, openExactAlarmSettings, reminderStatus } from "@/lib/reminders";

/**
 * A linha "Lembretes neste aparelho" de /settings. O estado real mora no navegador (permissão +
 * inscrição do push), não no nosso banco — por isso é lido do device a cada montagem em vez de vir
 * do contexto.
 */
export function PushToggle(): JSX.Element {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  // Android only: "Alarms & reminders" is a system setting, so it is re-read on every return.
  const [exact, setExact] = useState(true);

  useEffect(() => {
    void pushState().then(setState);
    if (!nativeReminders()) return;
    const read = () => {
      if (document.visibilityState === "visible")
        void reminderStatus().then((s) => setExact(s.exact));
    };
    read();
    document.addEventListener("visibilitychange", read);
    return () => document.removeEventListener("visibilitychange", read);
  }, []);

  const toggle = async () => {
    setBusy(true);
    try {
      const next = state === "on" ? await disablePush() : await enablePush();
      setState(next);
      if (next === "off" && state !== "on") toast.error(copy.form.notificationsError);
    } catch {
      // Registro do SW ou inscrição falhando estouravam calados e o botão parecia não fazer nada.
      toast.error(copy.form.notificationsError);
    } finally {
      setBusy(false);
    }
  };

  // Sem suporte ou com a permissão negada não há o que ligar: a linha só explica.
  const blocked = state === "unsupported" || state === "denied";

  return (
    <>
      <ListRow
        label={copy.profile.pushTitle}
        sublabel={
          state === "unsupported"
            ? copy.form.notificationsUnsupported
            : state === "denied"
              ? nativeReminders()
                ? copy.form.notificationsDeniedApp
                : copy.form.notificationsDenied
              : undefined
        }
        trailing={
          state === null ? (
            <Loader2Icon className="size-5 animate-spin text-ink-secondary" aria-hidden="true" />
          ) : blocked ? undefined : (
            <Switch
              aria-label={copy.profile.pushTitle}
              checked={state === "on"}
              disabled={busy}
              onCheckedChange={() => void toggle()}
            />
          )
        }
      />
      {state === "on" && !exact && (
        <ListRow
          label={copy.form.exactAlarmTitle}
          sublabel={copy.form.exactAlarmHint}
          accessory="external"
          onClick={() => void openExactAlarmSettings()}
        />
      )}
    </>
  );
}
