import { useSignIn, useSignUp } from "@clerk/clerk-react";
import { isClerkAPIResponseError } from "@clerk/clerk-react/errors";
import type { EmailLinkFactor, OAuthStrategy } from "@clerk/types";
import { useCallback, useReducer, useRef } from "react";
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
      dispatch({ type: "submit" });

      const redirectUrl = `${window.location.origin}/verify`;

      try {
        if (mode === "signUp") {
          await signUp.create({
            emailAddress: email,
            unsafeMetadata: { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
          });

          const { startEmailLinkFlow } = signUp.createEmailLinkFlow();
          dispatch({ type: "linkSent", email, at: Date.now() });

          const attempt = await startEmailLinkFlow({ redirectUrl });
          const verification = attempt.verifications.emailAddress;

          if (verification.status === "expired") return dispatch({ type: "expired" });
          if (attempt.status === "complete" && attempt.createdSessionId) {
            await setActive?.({ session: attempt.createdSessionId });
            dispatch({ type: "verified" });
            navigate(from, { replace: true });
          }
          return;
        }

        const { supportedFirstFactors } = await signIn.create({ identifier: email });
        const factor = supportedFirstFactors?.find(
          (f): f is EmailLinkFactor => f.strategy === "email_link",
        );
        if (!factor)
          return dispatch({ type: "failed", failure: { kind: "message", key: "generic" } });

        const { startEmailLinkFlow } = signIn.createEmailLinkFlow();
        dispatch({ type: "linkSent", email, at: Date.now() });

        const attempt = await startEmailLinkFlow({
          emailAddressId: factor.emailAddressId,
          redirectUrl,
        });

        if (attempt.firstFactorVerification.status === "expired") {
          return dispatch({ type: "expired" });
        }
        if (attempt.status === "complete" && attempt.createdSessionId) {
          await setActive?.({ session: attempt.createdSessionId });
          dispatch({ type: "verified" });
          navigate(from, { replace: true });
        }
      } catch (err) {
        fail(err);
      }
    },
    [isLoaded, signIn, signUp, mode, setActive, navigate, from, fail],
  );

  return {
    state,
    isLoaded,
    submit: start,
    resend: useCallback(() => start(lastEmail.current), [start]),
    reset: useCallback(() => dispatch({ type: "reset" }), []),
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
