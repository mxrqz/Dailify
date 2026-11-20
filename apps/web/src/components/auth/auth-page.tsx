import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";

import { carriedEmail, type AuthFailure, type AuthMode } from "@/components/auth/auth-state";
import { AuthShell } from "@/components/auth/auth-shell";
import { CheckInbox } from "@/components/auth/check-inbox";
import { copy } from "@/components/auth/copy";
import { EmailForm } from "@/components/auth/email-form";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { useEmailLinkAuth } from "@/components/auth/use-email-link-auth";
import { useSession } from "@/lib/auth";
import { isTauri } from "@/lib/platform";

/**
 * Corpo comum de /login e /signup. As duas rotas são a MESMA mecânica — a separação é de
 * enquadramento, então o que muda é só a copy e o destino do cross-link.
 */
export function AuthPage({ mode }: { mode: AuthMode }): JSX.Element {
  const { data: session } = useSession();
  const { state, from, captchaRef, submit, resend, reset, signInWithGoogle } = useEmailLinkAuth();
  // O Google que falha volta pra cá via `errorCallbackURL` com `?error=<código>`; a exclusão de
  // conta, com `?error=SESSION_EXPIRED`.
  const oauthError = useSearchParams()[0].get("error");
  const carried = carriedEmail(useLocation().state);
  const [email, setEmail] = useState(carried);
  const text = mode === "signUp" ? copy.signUp : copy.signIn;

  // O reenvio volta pra `sending` antes de virar `awaitingLink` de novo. Sem o `resendOf`, esse
  // intervalo renderizaria o formulário e a tela piscaria a cada clique em "reenviar".
  const inbox =
    state.status === "awaitingLink"
      ? state
      : state.status === "sending"
        ? state.resendOf
        : undefined;

  const failure: AuthFailure | undefined =
    state.status === "error"
      ? state.failure
      : state.status === "idle" && oauthError
        ? oauthError === "SESSION_EXPIRED"
          ? { key: "reauth" }
          : { key: "generic", code: oauthError }
        : undefined;

  // Quem já está logado não tem o que fazer aqui — e vai pro mesmo destino que o fluxo de e-mail
  // usaria, senão o deep link que o ProtectedRoute guardou some só porque a sessão já existia.
  if (session) return <Navigate to={from} replace />;

  return (
    <AuthShell
      {...(inbox
        ? {
            bubble: copy.inbox.bubble,
            mood: "happy" as const,
            footer: copy.inbox.spam,
            onBack: reset,
          }
        : {
            bubble: text.bubble,
            title: text.title,
            subtitle: text.subtitle,
            legalPrefix: text.legalPrefix,
            crossLinkPrefix: text.crossLinkPrefix,
            crossLinkAction: text.crossLinkAction,
            crossLinkTo: mode === "signUp" ? "/login" : "/signup",
            crossLinkEmail: email,
          })}
    >
      <Helmet>
        <title>{text.pageTitle}</title>
      </Helmet>
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
            disabled={state.status === "sending"}
            submitLabel={text.submit}
            failure={failure}
            defaultEmail={(state.status === "error" ? state.email : undefined) ?? carried}
            onEmailChange={setEmail}
          />
          {/* Google no app é a bd rzz.8: o redirect da webview não volta com a sessão. */}
          {!isTauri() && (
            <OAuthButtons onGoogle={signInWithGoogle} disabled={state.status === "sending"} />
          )}
        </>
      )}
      {/* Fora do condicional: o reenvio, na caixa de entrada, também precisa do widget montado. */}
      <div ref={captchaRef} />
    </AuthShell>
  );
}
