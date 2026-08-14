import { useUser } from "@clerk/clerk-react";
import { Navigate } from "react-router-dom";

import type { AuthFailure, AuthMode } from "@/components/auth/auth-state";
import { AuthShell } from "@/components/auth/auth-shell";
import { CheckInbox } from "@/components/auth/check-inbox";
import { copy } from "@/components/auth/copy";
import { EmailForm } from "@/components/auth/email-form";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { useEmailLinkAuth } from "@/components/auth/use-email-link-auth";

/**
 * Corpo comum de /login e /signup. As duas rotas são a MESMA mecânica — a separação é de
 * enquadramento, então o que muda é só a copy e o destino do cross-link.
 */
export function AuthPage({ mode }: { mode: AuthMode }): JSX.Element {
  const { isSignedIn } = useUser();
  const { state, isLoaded, from, submit, resend, reset, signInWithGoogle } = useEmailLinkAuth(mode);
  const text = mode === "signUp" ? copy.signUp : copy.signIn;

  // O reenvio volta pra `sending` antes de virar `awaitingLink` de novo. Sem o `resendOf`, esse
  // intervalo renderizaria o formulário e a tela piscaria a cada clique em "reenviar".
  const inbox =
    state.status === "awaitingLink"
      ? state
      : state.status === "sending"
        ? state.resendOf
        : undefined;

  // `expired` também cai no formulário, mas com o motivo e o e-mail já preenchido — sem isso o
  // link que vence larga o usuário num formulário em branco, sem nada explicando o que houve.
  const failure: AuthFailure | undefined =
    state.status === "error"
      ? state.failure
      : state.status === "expired"
        ? { kind: "message", key: "expiredLink" }
        : undefined;

  // Quem já está logado não tem o que fazer aqui — e vai pro mesmo destino que o fluxo de e-mail
  // usaria, senão o deep link que o ProtectedRoute guardou some só porque a sessão já existia.
  if (isSignedIn) return <Navigate to={from} replace />;

  return (
    <AuthShell
      title={text.title}
      legalPrefix={text.legalPrefix}
      crossLinkPrefix={text.crossLinkPrefix}
      crossLinkAction={text.crossLinkAction}
      crossLinkTo={mode === "signUp" ? "/login" : "/signup"}
    >
      {inbox ? (
        <CheckInbox
          email={inbox.email}
          sentAt={inbox.sentAt}
          busy={state.status === "sending"}
          onResend={resend}
          onBack={reset}
        />
      ) : (
        <>
          <EmailForm
            onSubmit={submit}
            disabled={!isLoaded || state.status === "sending"}
            submitLabel={text.submit}
            failure={failure}
            defaultEmail={
              state.status === "expired" || state.status === "error" ? state.email : undefined
            }
          />
          <OAuthButtons onGoogle={signInWithGoogle} disabled={!isLoaded} />
        </>
      )}
    </AuthShell>
  );
}
