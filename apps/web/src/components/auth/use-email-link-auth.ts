import { useSignIn, useSignUp } from "@clerk/clerk-react";
import { isClerkAPIResponseError } from "@clerk/clerk-react/errors";
import type { EmailLinkFactor, OAuthStrategy } from "@clerk/types";
import { useCallback, useEffect, useReducer, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  authReducer,
  classifyClerkError,
  initialAuthState,
  redirectTarget,
  type AuthMode,
} from "@/components/auth/auth-state";

/**
 * Liga o Clerk ao reducer de `auth-state.ts`. Nada de lógica mora aqui — se você for escrever um
 * `if` que não seja sobre a API do Clerk, ele pertence ao reducer, onde dá pra testar.
 *
 * O `redirectUrl` sai de `window.location.origin` e NÃO do `dailifyURL` de consts: aquele é a URL
 * de produção hardcoded, e usá-la fazia o link do e-mail em dev apontar pra prod.
 */
export function useEmailLinkAuth(mode: AuthMode) {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { signUp } = useSignUp();
  const navigate = useNavigate();
  const location = useLocation();
  const from = redirectTarget(location.state);

  const [state, dispatch] = useReducer(authReducer, initialAuthState);

  // Guardado num ref porque o `resend` precisa do último e-mail sem virar dependência do callback.
  const lastEmail = useRef("");

  // Cada `start` (e cada `reset`) ganha um número. Um run que resolve depois de outro começar é
  // fóssil e não pode mais despachar: sem isso, um `create` lento que o usuário abandonou pelo
  // "usar outro e-mail" volta atrasado e sequestra a tela do envio novo — a caixa de entrada
  // passaria a mostrar o e-mail ANTIGO enquanto o poller vivo é o do novo.
  const runId = useRef(0);

  // Cancela o poller do link anterior antes de iniciar outro — senão o antigo resolve por conta
  // própria mais tarde (unmount, ou um resend que gerou um novo link) e despacha em cima da
  // máquina atual, incluindo um `verified` roubado que navegaria a partir de qualquer estado.
  const cancelRef = useRef<(() => void) | null>(null);

  const fail = useCallback(
    (err: unknown) => {
      const code = isClerkAPIResponseError(err) ? err.errors[0]?.code : undefined;
      dispatch({ type: "failed", failure: classifyClerkError(code ?? "unknown", mode) });
    },
    [mode],
  );

  const start = useCallback(
    async (email: string) => {
      if (!isLoaded || !signIn || !signUp) return;

      lastEmail.current = email;
      const run = ++runId.current;
      const stale = () => run !== runId.current;
      dispatch({ type: "submit" });

      const redirectUrl = `${window.location.origin}/verify`;

      try {
        if (mode === "signUp") {
          await signUp.create({
            emailAddress: email,
            unsafeMetadata: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
          });
          // Antes do `cancelRef`, não só do dispatch: um fóssil aqui mataria o poller do run vivo.
          if (stale()) return;

          cancelRef.current?.();
          const { startEmailLinkFlow, cancelEmailLinkFlow } = signUp.createEmailLinkFlow();
          cancelRef.current = cancelEmailLinkFlow;
          dispatch({ type: "linkSent", email, at: Date.now() });

          const attempt = await startEmailLinkFlow({ redirectUrl });
          if (stale()) return;
          const verification = attempt.verifications.emailAddress;

          if (verification.status === "expired") return dispatch({ type: "expired" });
          if (attempt.status !== "complete" || !attempt.createdSessionId) {
            return dispatch({ type: "failed", failure: classifyClerkError("unknown", mode) });
          }

          await setActive?.({ session: attempt.createdSessionId });
          dispatch({ type: "verified" });
          navigate(from, { replace: true });
          return;
        }

        const { supportedFirstFactors } = await signIn.create({ identifier: email });
        if (stale()) return;

        const factor = supportedFirstFactors?.find(
          (f): f is EmailLinkFactor => f.strategy === "email_link",
        );
        if (!factor)
          return dispatch({ type: "failed", failure: { kind: "message", key: "generic" } });

        cancelRef.current?.();
        const { startEmailLinkFlow, cancelEmailLinkFlow } = signIn.createEmailLinkFlow();
        cancelRef.current = cancelEmailLinkFlow;
        dispatch({ type: "linkSent", email, at: Date.now() });

        const attempt = await startEmailLinkFlow({
          emailAddressId: factor.emailAddressId,
          redirectUrl,
        });
        if (stale()) return;

        if (attempt.firstFactorVerification.status === "expired") {
          return dispatch({ type: "expired" });
        }
        if (attempt.status !== "complete" || !attempt.createdSessionId) {
          return dispatch({ type: "failed", failure: classifyClerkError("unknown", mode) });
        }

        await setActive?.({ session: attempt.createdSessionId });
        dispatch({ type: "verified" });
        navigate(from, { replace: true });
      } catch (err) {
        if (stale()) return;
        fail(err);
      }
    },
    [isLoaded, signIn, signUp, mode, setActive, navigate, from, fail],
  );

  // Cancela o poller pendente ao desmontar — senão ele segue rodando até o TTL do link e
  // despacha (ou navega) numa árvore que já saiu de cena.
  useEffect(() => () => cancelRef.current?.(), []);

  return {
    state,
    isLoaded,
    from,
    submit: start,
    resend: useCallback(() => start(lastEmail.current), [start]),
    // Incrementa a geração: sair da tela abandona o run em voo, mesmo que nenhum outro comece.
    reset: useCallback(() => {
      runId.current++;
      dispatch({ type: "reset" });
    }, []),
    signInWithGoogle: useCallback(() => {
      if (!signIn) return;
      const strategy: OAuthStrategy = "oauth_google";
      signIn
        .authenticateWithRedirect({
          strategy,
          redirectUrl: "/sso-callback",
          redirectUrlComplete: from,
        })
        .catch(fail);
    }, [signIn, from, fail]),
  };
}
