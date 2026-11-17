import { useCallback, useEffect, useRef } from "react";

type TurnstileApi = {
  render: (
    el: HTMLElement,
    options: {
      sitekey: string;
      appearance: "interaction-only";
      size: "flexible";
      language: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;
// Passou disso sem token, manda vazio: o servidor responde captcha e a tela diz o que houve.
const TOKEN_TIMEOUT_MS = 15_000;

let loading: Promise<TurnstileApi> | undefined;
function loadTurnstile(): Promise<TurnstileApi> {
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error(SCRIPT));
    script.onerror = () => {
      loading = undefined;
      reject(new Error(SCRIPT));
    };
    document.head.append(script);
  });
  return loading;
}

/**
 * Turnstile em modo `interaction-only`: invisível, só aparece no `ref` se a Cloudflare pedir um
 * desafio. O script só carrega quando a tela de auth monta. `token()` entrega um token de uso
 * único e já pede o próximo (o reenvio precisa de outro). Sem site key (dev/teste) devolve "".
 */
export function useTurnstile() {
  const ref = useRef<HTMLDivElement>(null);
  const widget = useRef<{ api: TurnstileApi; id: string } | null>(null);
  const ready = useRef<string | null>(null);
  const waiting = useRef<((token: string) => void) | null>(null);

  const deliver = useCallback((token: string) => {
    if (waiting.current) {
      waiting.current(token);
      waiting.current = null;
    } else {
      ready.current = token || null;
    }
  }, []);

  useEffect(() => {
    if (!SITE_KEY) return;
    let cancelled = false;
    loadTurnstile()
      .then((api) => {
        if (cancelled || !ref.current) return;
        const id = api.render(ref.current, {
          sitekey: SITE_KEY,
          appearance: "interaction-only",
          size: "flexible",
          language: "pt-br",
          callback: deliver,
          "expired-callback": () => (ready.current = null),
          "error-callback": () => deliver(""),
        });
        widget.current = { api, id };
      })
      // Script bloqueado (adblock, rede): o envio vai sem token e cai no erro de captcha.
      .catch(() => deliver(""));
    return () => {
      cancelled = true;
      widget.current?.api.remove(widget.current.id);
      widget.current = null;
    };
  }, [deliver]);

  const token = useCallback((): Promise<string> => {
    if (!SITE_KEY) return Promise.resolve("");
    const consume = (t: string) => {
      if (widget.current) widget.current.api.reset(widget.current.id);
      return t;
    };
    if (ready.current) {
      const t = ready.current;
      ready.current = null;
      return Promise.resolve(consume(t));
    }
    return new Promise<string>((resolve) => {
      const timer = setTimeout(() => deliver(""), TOKEN_TIMEOUT_MS);
      waiting.current = (t) => {
        clearTimeout(timer);
        resolve(consume(t));
      };
    });
  }, [deliver]);

  return { ref, token };
}
