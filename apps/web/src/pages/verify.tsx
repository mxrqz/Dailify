import { useClerk } from "@clerk/clerk-react";
import { EmailLinkErrorCodeStatus, isEmailLinkError } from "@clerk/clerk-react/errors";
import { Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { AuthShell } from "@/components/auth/auth-shell";
import { copy } from "@/components/auth/copy";
import { Button } from "@/components/ui/button";

type Status =
  "loading" | "verified" | "verified_switch_tab" | "expired" | "client_mismatch" | "failed";

/**
 * A aba que o link do e-mail abre.
 *
 * A versão anterior era estática: dizia "Authentication Successful" sempre, inclusive com o link
 * expirado ou aberto em outro dispositivo, e chamava `window.close()` — que o navegador ignora em
 * abas que o script não abriu. Agora ela chama de fato o Clerk e mostra o que aconteceu.
 */
export default function Verify() {
  const { handleEmailLinkVerification, loaded } = useClerk();
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!loaded) return;

    handleEmailLinkVerification({
      onVerifiedOnOtherDevice: () => setStatus("verified_switch_tab"),
    })
      .then(() => setStatus((prev) => (prev === "loading" ? "verified" : prev)))
      // `Promise.catch`'s reason is `any`, não `unknown` — anotar como `Error` (sem `as`) é o que
      // `isEmailLinkError` exige na 5.61.3.
      .catch((err: Error) => {
        if (isEmailLinkError(err)) {
          if (err.code === EmailLinkErrorCodeStatus.Expired) return setStatus("expired");
          if (err.code === EmailLinkErrorCodeStatus.ClientMismatch) {
            return setStatus("client_mismatch");
          }
        }
        setStatus("failed");
      });
  }, [handleEmailLinkVerification, loaded]);

  const message = {
    loading: copy.verify.loading,
    verified: copy.verify.verified,
    verified_switch_tab: copy.verify.switchTab,
    expired: copy.verify.expired,
    client_mismatch: copy.verify.clientMismatch,
    failed: copy.verify.failed,
  }[status];

  const canRestart = status === "expired" || status === "failed";

  // Mesma casca de /login e /signup, sem título, cross-link ou rodapé legal — todos opcionais.
  return (
    <AuthShell>
      <div className="flex flex-col items-center gap-4 text-center">
        {status === "loading" && <Loader2Icon className="size-6 animate-spin text-primary" />}

        <p className="text-sm text-foreground">{message}</p>

        {canRestart && (
          <Button asChild variant="outline" className="w-full">
            <Link to="/login">{copy.verify.restart}</Link>
          </Button>
        )}
      </div>
    </AuthShell>
  );
}
