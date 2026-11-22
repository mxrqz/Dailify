import { useCallback, useReducer, useRef } from "react";
import { useLocation } from "react-router-dom";

import {
  authReducer,
  classifyAuthError,
  initialAuthState,
  redirectTarget,
} from "@/components/auth/auth-state";
import { useTurnstile } from "@/components/auth/turnstile";
import { authClient } from "@/lib/auth";
import { startNativeGoogle, startNativeMagicLink, verifyNativeCode } from "@/lib/native-auth";
import { isTauri } from "@/lib/platform";

/**
 * Liga o Better Auth ao reducer de `auth-state.ts`. Nada de lógica mora aqui — se você for escrever
 * um `if` que não seja sobre a API do Better Auth, ele pertence ao reducer, onde dá pra testar.
 *
 * Login e cadastro são a mesma chamada (o magic link cria a conta no primeiro verify); o `mode` só
 * muda a copy. Não há polling: o link do e-mail abre a /verify, que termina o login.
 *
 * As URLs saem de `window.location.origin`: uma URL de produção fixa fazia o link em dev apontar
 * pra prod.
 */
export function useEmailLinkAuth() {
  const location = useLocation();
  const from = redirectTarget(location.state, location.search);
  const { ref: captchaRef, token: captchaToken } = useTurnstile();

  const [state, dispatch] = useReducer(authReducer, initialAuthState);

  // Guardado num ref porque o `resend` precisa do último e-mail sem virar dependência do callback.
  const lastEmail = useRef("");

  // Cada envio (e cada `reset`) ganha um número. Um envio que resolve depois de outro começar é
  // fóssil e não pode mais despachar: sem isso, um envio lento que o usuário abandonou pelo
  // "usar outro e-mail" volta atrasado e sequestra a tela.
  const runId = useRef(0);

  const start = useCallback(
    async (email: string) => {
      lastEmail.current = email;
      const run = ++runId.current;
      dispatch({ type: "submit" });

      try {
        const token = await captchaToken();
        // No app o link volta pelo deep link e só verifica com o verifier guardado neste aparelho.
        const { error } = await (isTauri()
          ? startNativeMagicLink(email, token)
          : authClient.signIn.magicLink({
              email,
              callbackURL: window.location.origin + from,
              fetchOptions: { headers: { "x-captcha-response": token } },
            }));
        if (run !== runId.current) return;
        dispatch(
          error
            ? { type: "failed", failure: classifyAuthError(error) }
            : { type: "linkSent", email, at: Date.now() },
        );
      } catch {
        if (run !== runId.current) return;
        dispatch({ type: "failed", failure: classifyAuthError(null) });
      }
    },
    [captchaToken, from],
  );

  return {
    state,
    from,
    captchaRef,
    submit: start,
    resend: useCallback(() => start(lastEmail.current), [start]),
    // The code from the same e-mail. In the app the bearer lands in the keyring like a link's.
    verifyCode: useCallback(async (email: string, otp: string) => {
      try {
        const { error } = await (isTauri()
          ? verifyNativeCode(email, otp)
          : authClient.signIn.emailOtp({ email, otp }));
        return error ? classifyAuthError(error) : null;
      } catch {
        return classifyAuthError(null);
      }
    }, []),
    reset: useCallback(() => {
      runId.current++;
      dispatch({ type: "reset" });
    }, []),
    signInWithGoogle: useCallback(() => {
      // The webview's redirect wouldn't come back with the session: the system browser signs in.
      if (isTauri()) {
        startNativeGoogle().catch(() =>
          dispatch({ type: "failed", failure: classifyAuthError(null) }),
        );
        return;
      }
      const origin = window.location.origin;
      // Sucesso navega a página inteira pro Google; só um erro antes disso volta pra cá.
      authClient.signIn
        .social({
          provider: "google",
          callbackURL: origin + from,
          errorCallbackURL: `${origin}/login`,
        })
        .then(({ error }) => {
          if (error) dispatch({ type: "failed", failure: classifyAuthError(error) });
        })
        .catch(() => dispatch({ type: "failed", failure: classifyAuthError(null) }));
    }, [from]),
  };
}
