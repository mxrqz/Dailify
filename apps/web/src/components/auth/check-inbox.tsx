import { ArrowLeftIcon, MailIcon, RotateCwIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { type AuthFailure, canResend, RESEND_COOLDOWN_MS } from "@/components/auth/auth-state";
import { copy } from "@/components/auth/copy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fill } from "@/functions/functions";
import { formString } from "@/lib/form";

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
  busy,
  onResend,
  onBack,
  onCode,
}: {
  email: string;
  sentAt: number;
  /**
   * Um reenvio em voo. Sem isso o botão fica clicável durante o round-trip (o cooldown do link
   * anterior já venceu) e cada clique manda mais um e-mail — o usuário acaba com vários links e
   * sem saber qual vale. O "usar outro e-mail" segue liberado de propósito: é a saída de
   * emergência se a rede travar, e um `linkSent` atrasado é ignorado fora de `sending`.
   */
  busy?: boolean;
  onResend: () => void;
  onBack: () => void;
  /** Signs in with the e-mailed code; resolves to the failure, or null once the session lands. */
  onCode: (code: string) => Promise<AuthFailure | null>;
}): JSX.Element {
  const remaining = useCooldown(sentAt);
  const [verifying, setVerifying] = useState(false);
  const [codeFailure, setCodeFailure] = useState<AuthFailure | null>(null);

  const submitCode = async (code: string) => {
    setVerifying(true);
    setCodeFailure(null);
    const failure = await onCode(code);
    // On success the page leaves for `from` as soon as the session lands; stay busy until then.
    if (failure) {
      setCodeFailure(failure);
      setVerifying(false);
    }
  };

  return (
    <div className="flex flex-col items-center text-center">
      {/* `status` só neste bloco, que é estático: englobar o botão faria o `aria-atomic` implícito
          re-anunciar a tela inteira a cada segundo do contador do reenvio. */}
      <div role="status" className="flex max-w-full flex-col items-center">
        <h1 className="mt-7 text-title-1">{copy.inbox.title}</h1>
        <p className="mt-2 text-body leading-6 text-ink-secondary">{copy.inbox.sentTo}</p>
        <p className="mt-3 inline-flex h-9 max-w-full items-center gap-2 rounded-sm bg-surface px-3.5 text-body font-semibold">
          <MailIcon aria-hidden="true" className="size-4 flex-none text-ink-secondary" />
          <span className="truncate">{email}</span>
        </p>
      </div>

      <p className="mt-5 max-w-75 text-subhead text-balance text-ink-secondary">
        {copy.inbox.hint}
      </p>

      <form
        className="mt-6 flex w-full flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submitCode(formString(new FormData(e.currentTarget), "code"));
        }}
      >
        <label htmlFor="code" className="sr-only">
          {copy.inbox.codeLabel}
        </label>
        <Input
          id="code"
          name="code"
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          placeholder={copy.inbox.codePlaceholder}
          className="h-13 rounded-md border-0 bg-fill px-4 text-center font-mono text-title-1 tracking-widest shadow-none placeholder:text-ink-tertiary md:text-title-1"
          aria-invalid={codeFailure?.key === "invalidCode"}
          aria-describedby={codeFailure ? "code-error" : undefined}
        />
        {codeFailure && (
          <p id="code-error" className="px-1 text-subhead text-brand-text">
            {copy.errors[codeFailure.key]}
            {codeFailure.code && <span className="ml-1 caps opacity-70">{codeFailure.code}</span>}
          </p>
        )}
        <Button type="submit" size="lg" loading={verifying}>
          {copy.inbox.codeSubmit}
        </Button>
      </form>

      <div className="mt-6 flex w-full flex-col gap-2">
        <Button
          size="lg"
          variant="secondary"
          className="tabular-nums"
          onClick={onResend}
          disabled={remaining > 0 || busy}
        >
          <RotateCwIcon className={busy ? "animate-spin" : undefined} />
          {remaining > 0 ? fill(copy.inbox.resendIn, { seconds: remaining }) : copy.inbox.resend}
        </Button>

        <Button size="lg" variant="ghost" onClick={onBack}>
          <ArrowLeftIcon />
          {copy.inbox.back}
        </Button>
      </div>
    </div>
  );
}
