import { useCallback, useReducer, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  authReducer,
  classifyAuthError,
  initialAuthState,
  needsSecondFactor,
  redirectTarget,
  secondFactorPath,
  type AuthMode,
} from "@/components/auth/auth-state";
import { useTurnstile } from "@/components/auth/turnstile";
import { authClient } from "@/lib/auth";
import {
  signInNativePassword,
  startNativeGoogle,
  startNativeMagicLink,
  verifyNativeCode,
} from "@/lib/native-auth";
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
  const navigate = useNavigate();
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

  // E-mail + password. Sign-up never signs in: the confirmation link does (`autoSignIn...`).
  const submitPassword = useCallback(
    async (mode: AuthMode, email: string, password: string) => {
      const run = ++runId.current;
      dispatch({ type: "submit" });
      try {
        const headers = { "x-captcha-response": await captchaToken() };
        const { data, error } = await (mode === "signUp"
          ? authClient.signUp.email({
              email,
              password,
              name: "",
              ...(!isTauri() && { callbackURL: window.location.origin + from }),
              fetchOptions: { headers },
            })
          : isTauri()
            ? signInNativePassword(email, password, headers["x-captcha-response"])
            : authClient.signIn.email({ email, password, fetchOptions: { headers } }));
        if (run !== runId.current) return;
        if (error) return dispatch({ type: "failed", failure: classifyAuthError(error) });
        if (mode === "signUp") return dispatch({ type: "verifySent", email });
        // Otherwise the session lands and AuthPage leaves for `from`.
        if (needsSecondFactor(data)) navigate(secondFactorPath(from));
      } catch {
        if (run !== runId.current) return;
        dispatch({ type: "failed", failure: classifyAuthError(null) });
      }
    },
    [captchaToken, from, navigate],
  );

  return {
    state,
    from,
    captchaRef,
    submit: start,
    submitPassword,
    resend: useCallback(() => start(lastEmail.current), [start]),
    // The code from the same e-mail. In the app the bearer lands in the keyring like a link's.
    verifyCode: useCallback(
      async (email: string, otp: string) => {
        try {
          const { data, error } = await (isTauri()
            ? verifyNativeCode(email, otp)
            : authClient.signIn.emailOtp({ email, otp }));
          if (error) return classifyAuthError(error);
          if (needsSecondFactor(data)) navigate(secondFactorPath(from));
          return null;
        } catch {
          return classifyAuthError(null);
        }
      },
      [from, navigate],
    ),
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
