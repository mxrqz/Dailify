import { ArrowLeftIcon, MailIcon, RotateCwIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { canResend, RESEND_COOLDOWN_MS } from "@/components/auth/auth-state";
import { copy } from "@/components/auth/copy";
import { Button } from "@/components/ui/button";

/** Segundos que faltam pro reenvio liberar. Zero = liberado. */
function useCooldown(sentAt: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (canResend(sentAt, Date.now())) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      // O guard de início só roda no mount/troca de sentAt — sem isso o interval
      // continua batendo pra sempre depois que o cooldown já liberou.
      if (canResend(sentAt, t)) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [sentAt]);

  return Math.max(0, Math.ceil((sentAt + RESEND_COOLDOWN_MS - now) / 1000));
}

export function CheckInbox({
  email,
  sentAt,
  onResend,
  onBack,
}: {
  email: string;
  sentAt: number;
  onResend: () => void;
  onBack: () => void;
}): JSX.Element {
  const remaining = useCooldown(sentAt);

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="rounded-full bg-accent-subtle p-4">
        <MailIcon className="size-6 text-primary" />
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-foreground">{copy.inbox.title}</h2>
        <p className="text-sm text-muted-foreground">{copy.inbox.sentTo}</p>
        <p className="font-mono text-sm text-foreground">{email}</p>
      </div>

      <p className="text-sm text-muted-foreground">{copy.inbox.hint}</p>

      <Button variant="outline" className="w-full" onClick={onResend} disabled={remaining > 0}>
        <RotateCwIcon />
        {remaining > 0
          ? `${copy.inbox.resendIn} ${remaining}${copy.inbox.seconds}`
          : copy.inbox.resend}
      </Button>

      <Button variant="ghost" className="w-full" onClick={onBack}>
        <ArrowLeftIcon />
        {copy.inbox.back}
      </Button>
    </div>
  );
}
