import { MailIcon } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { Helmet } from "react-helmet-async";
import { Navigate, useLocation, useSearchParams } from "react-router-dom";

import { carriedEmail, type AuthFailure, type AuthMode } from "@/components/auth/auth-state";
import { AuthShell } from "@/components/auth/auth-shell";
import { CheckInbox } from "@/components/auth/check-inbox";
import { copy } from "@/components/auth/copy";
import { EmailForm } from "@/components/auth/email-form";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { useEmailLinkAuth } from "@/components/auth/use-email-link-auth";
import { Splash } from "@/components/splash";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth";
import { isSigningIn, onSigningIn } from "@/lib/native-auth";

/**
 * Corpo comum de /login e /signup. As duas rotas são a MESMA mecânica — a separação é de
 * enquadramento, então o que muda é só a copy e o destino do cross-link.
 */
export function AuthPage({ mode }: { mode: AuthMode }): JSX.Element {
  const { data: session } = useSession();
  const signingIn = useSyncExternalStore(onSigningIn, isSigningIn);
  const {
    state,
    from,
    captchaRef,
    submit,
    submitPassword,
    resend,
    reset,
    verifyCode,
    signInWithGoogle,
  } = useEmailLinkAuth();
  // Password first, as in the design; the magic link stays one tap away.
  const [method, setMethod] = useState<"password" | "link">("password");
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
  if (signingIn) return <Splash />;

  const confirming = state.status === "verifySent" ? state.email : undefined;
  const sending = state.status === "sending";

  return (
    <AuthShell
      {...(confirming
        ? {
            bubble: copy.verifySent.bubble,
            mood: "happy" as const,
            footer: copy.inbox.spam,
            onBack: reset,
          }
        : inbox
          ? {
              bubble: copy.inbox.bubble,
              mood: "happy" as const,
              footer: copy.inbox.spam,
              onBack: reset,
            }
          : {
              bubble: text.bubble,
              title: text.title,
              subtitle: method === "password" ? text.subtitle : text.linkSubtitle,
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
      {confirming ? (
        <div role="status" className="flex flex-col items-center text-center">
          <h1 className="mt-7 text-title-1">{copy.verifySent.title}</h1>
          <p className="mt-2 text-body leading-6 text-ink-secondary">{copy.verifySent.sentTo}</p>
          <p className="mt-3 inline-flex h-9 max-w-full items-center gap-2 rounded-sm bg-surface px-3.5 text-body font-semibold">
            <MailIcon aria-hidden="true" className="size-4 flex-none text-ink-secondary" />
            <span className="truncate">{confirming}</span>
          </p>
          <p className="mt-5 text-subhead text-ink-secondary">{copy.verifySent.hint}</p>
          <Button size="lg" variant="ghost" className="mt-6 w-full" onClick={reset}>
            {copy.verifySent.back}
          </Button>
        </div>
      ) : inbox ? (
        <CheckInbox
          email={inbox.email}
          sentAt={inbox.sentAt}
          busy={state.status === "sending"}
          onResend={resend}
          onBack={reset}
          onCode={(code) => verifyCode(inbox.email, code)}
        />
      ) : (
        <>
          <EmailForm
            key={method}
            onSubmit={(address, password) =>
              method === "password" ? submitPassword(mode, address, password) : submit(address)
            }
            disabled={sending}
            submitLabel={method === "password" ? text.passwordSubmit : text.submit}
            failure={failure}
            defaultEmail={
              (state.status === "error" ? state.email : undefined) ?? (email || carried)
            }
            onEmailChange={setEmail}
            {...(method === "password" && {
              password:
                mode === "signUp" ? ("new-password" as const) : ("current-password" as const),
              forgotTo: mode === "signIn" ? "/reset-password" : undefined,
            })}
          />
          <OAuthButtons onGoogle={signInWithGoogle} disabled={sending} />
          <Button
            type="button"
            size="lg"
            variant="secondary"
            disabled={sending}
            onClick={() => {
              reset();
              setMethod(method === "password" ? "link" : "password");
            }}
          >
            {method === "password" ? copy.shell.emailLink : copy.shell.usePassword}
          </Button>
        </>
      )}
      {/* Fora do condicional: o reenvio, na caixa de entrada, também precisa do widget montado. */}
      <div ref={captchaRef} />
    </AuthShell>
  );
}
