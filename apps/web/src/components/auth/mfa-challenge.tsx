import { ShieldIcon } from "lucide-react";
import { useState } from "react";

import { classifyAuthError, type AuthFailure } from "@/components/auth/auth-state";
import { copy } from "@/components/auth/copy";
import { ListGroup, ListRow } from "@/components/kit/list";
import { OtpInput } from "@/components/kit/otp-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { settle } from "@/lib/auth";
import { formString } from "@/lib/form";
import { sendSecondFactorEmail, verifySecondFactor, type SecondFactor } from "@/lib/native-auth";

const PROMPT = {
  totp: copy.mfa.totp,
  otp: copy.mfa.otp,
  backup: copy.mfa.backup,
} satisfies Record<SecondFactor, string>;

/** "Confirme que é você": one factor's input, the trust box, and the other factors below. */
export function MfaChallenge({
  kind,
  onKind,
  busy,
  failure,
  notice,
  showTrust,
  onSubmit,
  onSendEmail,
}: {
  kind: SecondFactor;
  onKind: (kind: SecondFactor) => void;
  busy: boolean;
  failure: AuthFailure | null;
  /** "Código enviado": the e-mailed code is on its way. */
  notice?: string;
  /** Sign-in only: a step-up never re-trusts the device. */
  showTrust: boolean;
  onSubmit: (code: string, trust: boolean) => void;
  onSendEmail: () => void;
}): JSX.Element {
  const [trust, setTrust] = useState(true);
  const submit = (code: string) => onSubmit(code, showTrust && trust);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="grid size-12 place-items-center rounded-md bg-fill [&_svg]:size-6">
          <ShieldIcon aria-hidden="true" />
        </span>
        <h1 className="mt-2 text-title-1">{copy.mfa.title}</h1>
        <p className="text-body text-ink-secondary">{PROMPT[kind]}</p>
      </div>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit(formString(new FormData(e.currentTarget), "code"));
        }}
      >
        {kind === "backup" ? (
          <Input
            name="code"
            required
            autoComplete="off"
            aria-label={copy.mfa.backupLabel}
            aria-invalid={failure !== null}
            aria-describedby={failure ? "mfa-error" : undefined}
            className="h-13 rounded-md border-0 bg-fill px-4 text-body shadow-none md:text-body"
          />
        ) : (
          <OtpInput
            key={kind}
            name="code"
            required
            aria-describedby={failure ? "mfa-error" : undefined}
            error={failure !== null}
            disabled={busy}
            onComplete={submit}
          />
        )}
        {failure && (
          <p id="mfa-error" className="px-1 text-subhead text-brand-text">
            {copy.errors[failure.key]}
            {failure.code && <span className="ml-1 caps opacity-70">{failure.code}</span>}
          </p>
        )}
        {notice && !failure && (
          <p role="status" className="px-1 text-subhead text-ink-secondary">
            {notice}
          </p>
        )}
        {showTrust && (
          <label className="flex min-h-11 items-center gap-2.5 text-subhead">
            <input
              type="checkbox"
              checked={trust}
              onChange={(e) => setTrust(e.target.checked)}
              className="size-5 accent-brand"
            />
            {copy.mfa.trust}
          </label>
        )}
        <Button type="submit" size="lg" loading={busy}>
          {copy.mfa.submit}
        </Button>
      </form>

      <ListGroup>
        {kind !== "otp" && <ListRow label={copy.mfa.useEmail} onClick={onSendEmail} />}
        {kind !== "backup" && (
          <ListRow label={copy.mfa.useBackup} onClick={() => onKind("backup")} />
        )}
        {kind !== "totp" && <ListRow label={copy.mfa.useApp} onClick={() => onKind("totp")} />}
      </ListGroup>
    </div>
  );
}

/** The challenge's wiring, shared by `/two-factor` and the step-up dialog. */
export function useSecondFactor(onVerified: () => void) {
  const [kind, setKind] = useState<SecondFactor>("totp");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<AuthFailure | null>(null);
  const [notice, setNotice] = useState<string>();

  return {
    kind,
    busy,
    failure,
    notice,
    onKind: (next: SecondFactor) => {
      setKind(next);
      setFailure(null);
      setNotice(undefined);
    },
    onSubmit: async (code: string, trust: boolean) => {
      setBusy(true);
      setFailure(null);
      const { error } = await settle(verifySecondFactor(kind, code, trust));
      setBusy(false);
      if (error) return setFailure(classifyAuthError(error));
      onVerified();
    },
    onSendEmail: async () => {
      setKind("otp");
      setFailure(null);
      const { error } = await settle(sendSecondFactorEmail());
      if (error) setFailure(classifyAuthError(error));
      else setNotice(copy.mfa.emailSent);
    },
  };
}
