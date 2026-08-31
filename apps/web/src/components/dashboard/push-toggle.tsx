import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { BellIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { copy } from "@/components/dashboard/copy";
import { disablePush, enablePush, pushState, type PushState } from "@/functions/push";

/**
 * O estado real mora no navegador (permissão + inscrição do push), não no nosso banco — por isso é
 * lido do device a cada montagem em vez de vir do contexto.
 */
export function PushToggle(): JSX.Element {
  const { getToken } = useAuth();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void pushState().then(setState);
  }, []);

  const toggle = async () => {
    setBusy(true);
    try {
      const token = await getToken();
      if (!token) return;
      const next = state === "on" ? await disablePush(token) : await enablePush(token);
      setState(next);
      if (next === "off" && state !== "on") toast.error(copy.form.notificationsError);
    } finally {
      setBusy(false);
    }
  };

  if (state === null) return <Loader2Icon className="size-4 animate-spin text-muted-foreground" />;

  if (state === "unsupported" || state === "denied") {
    return (
      <p className="text-sm text-content-secondary">
        {state === "unsupported"
          ? copy.form.notificationsUnsupported
          : copy.form.notificationsDenied}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-content-secondary">
        {state === "on" ? copy.form.notificationsOn : copy.form.notificationsOff}
      </p>
      <Button
        variant={state === "on" ? "outline" : "default"}
        disabled={busy}
        onClick={() => void toggle()}
        className="w-fit cursor-pointer gap-2 rounded-full"
      >
        {busy ? <Loader2Icon className="size-4 animate-spin" /> : <BellIcon className="size-4" />}
        {state === "on" ? copy.form.notificationsDisable : copy.form.notificationsEnable}
      </Button>
    </div>
  );
}
