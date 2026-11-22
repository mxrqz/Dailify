import { ShieldCheckIcon } from "lucide-react";

import type { AuthFailure } from "@/components/auth/auth-state";
import { copy } from "@/components/auth/copy";
import { OtpInput } from "@/components/kit/otp-input";
import { QrCode } from "@/components/kit/qr-code";
import { Button } from "@/components/ui/button";

const STEP = "text-subhead font-medium text-ink-secondary";

/** The base32 key inside an `otpauth://` URI, in groups of four for typing by hand. */
export function manualKey(uri: string): string {
  const secret = new URL(uri).searchParams.get("secret") ?? "";
  return secret.match(/.{1,4}/g)?.join(" ") ?? "";
}

/**
 * Steps 1 and 2 of turning MFA on: add the account to an authenticator, then prove it with a code.
 * On a phone the `otpauth://` link opens the default code app (`onOpenUri` in the app, a plain link
 * on the web); on a computer the QR code takes its place. The manual key is always one tap away.
 */
export function MfaSetup({
  uri,
  mobile,
  onOpenUri,
  onCopyKey,
  onVerify,
  busy,
  failure,
}: {
  uri: string;
  mobile: boolean;
  /** The app opens the link through the system; without it, a plain `<a>`. */
  onOpenUri?: () => void;
  onCopyKey: (key: string) => void;
  onVerify: (code: string) => void;
  busy: boolean;
  failure: AuthFailure | null;
}): JSX.Element {
  const key = manualKey(uri);
  const auto = (
    <>
      <ShieldCheckIcon aria-hidden="true" />
      {copy.mfaSetup.addAuto}
    </>
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2.5">
        <h3 className={STEP}>{copy.mfaSetup.step1}</h3>
        {mobile ? (
          <>
            {onOpenUri ? (
              <Button size="lg" onClick={onOpenUri}>
                {auto}
              </Button>
            ) : (
              <Button asChild size="lg">
                <a href={uri}>{auto}</a>
              </Button>
            )}
            <p className="text-footnote text-ink-secondary">{copy.mfaSetup.addAutoHint}</p>
          </>
        ) : (
          <>
            <QrCode value={uri} label={copy.mfaSetup.qrLabel} className="w-48 self-center p-2" />
            <p className="text-footnote text-ink-secondary">{copy.mfaSetup.scan}</p>
          </>
        )}
        <details className="rounded-md bg-fill px-4">
          <summary className="flex min-h-12 cursor-pointer items-center text-subhead font-medium">
            {copy.mfaSetup.addManual}
          </summary>
          <div className="flex flex-col gap-2 pb-3.5">
            <code className="text-subhead tracking-wide break-all tabular-nums">{key}</code>
            <Button
              size="sm"
              variant="secondary"
              className="self-start"
              onClick={() => onCopyKey(key.replace(/ /g, ""))}
            >
              {copy.mfaSetup.copyKey}
            </Button>
          </div>
        </details>
      </section>

      <section className="flex flex-col gap-2.5">
        <h3 className={STEP}>{copy.mfaSetup.step2}</h3>
        <OtpInput
          aria-describedby={failure ? "setup-error" : undefined}
          error={failure !== null}
          disabled={busy}
          onComplete={onVerify}
        />
        {failure && (
          <p id="setup-error" className="px-1 text-subhead text-brand-text">
            {copy.errors[failure.key]}
          </p>
        )}
      </section>
    </div>
  );
}

/** Step 3: the recovery codes, shown once, to copy or save as a file. */
export function RecoveryCodes({
  codes,
  onCopy,
  onDownload,
}: {
  codes: string[];
  onCopy: () => void;
  onDownload: () => void;
}): JSX.Element {
  return (
    <section className="flex flex-col gap-2.5 rounded-lg bg-fill p-4">
      <h3 className="text-body font-semibold">{copy.mfaSetup.codesTitle}</h3>
      <p className="text-subhead text-ink-secondary">{copy.mfaSetup.codesHint}</p>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-subhead tracking-wide tabular-nums">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={onCopy}>
          {copy.mfaSetup.copy}
        </Button>
        <Button variant="secondary" className="flex-1" onClick={onDownload}>
          {copy.mfaSetup.download}
        </Button>
      </div>
    </section>
  );
}
