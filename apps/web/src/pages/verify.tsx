import { Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import type { AuthErrorKey } from "@/components/auth/auth-state";
import { AuthShell } from "@/components/auth/auth-shell";
import { copy } from "@/components/auth/copy";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth";
import { internalPath } from "@/lib/platform";

type Status = "ready" | "verifying" | "invalid" | AuthErrorKey;

/**
 * Onde o link do e-mail cai: `/verify#token=…&next=…`. O token vem no hash (não chega a servidor nenhum)
 * e só é gasto no clique em "Entrar" — scanner de e-mail (Safe Links) abre a página mas não clica.
 */
export default function Verify() {
  const navigate = useNavigate();
  // `next` vem do servidor (a página que pediu o login); só vale caminho deste site.
  const [{ token, next }] = useState(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    return { token: params.get("token"), next: internalPath(params.get("next")) };
  });
  const [status, setStatus] = useState<Status>(token ? "ready" : "invalid");

  // Tira o token da barra de endereço (histórico, print, compartilhar a aba).
  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(window.history.state, "", window.location.pathname);
    }
  }, []);

  const verify = async () => {
    if (!token) return;
    setStatus("verifying");
    try {
      // `manual`: sem `callbackURL`, sucesso é 200 com JSON; token ruim é um 302 pro
      // `errorCallbackURL`, que aqui vira resposta opaca (status 0) em vez de seguir pra API.
      const { error } = await authClient.magicLink.verify({
        query: { token },
        fetchOptions: { redirect: "manual" },
      });
      if (!error) {
        // O verify não está entre as rotas que avisam o átomo da sessão: avisa na mão.
        authClient.$store.notify("$sessionSignal");
        navigate(next, { replace: true });
        return;
      }
      setStatus(error.status === 429 ? "tooManyRequests" : "invalid");
    } catch {
      setStatus("network");
    }
  };

  const message =
    status === "ready" || status === "verifying"
      ? copy.verify.ready
      : status === "invalid"
        ? copy.verify.invalid
        : copy.errors[status];

  // Mesma casca de /login e /signup, sem título, cross-link ou rodapé legal — todos opcionais.
  return (
    <AuthShell>
      <div className="flex flex-col items-center gap-4 pt-24 text-center">
        {/* `status`: o desfecho troca o texto sem navegação, então sem live region o leitor de
            tela não anuncia nada. */}
        <p role="status" className="text-body text-ink">
          {message}
        </p>

        {status === "invalid" ? (
          <Button asChild size="lg" variant="secondary" className="w-full">
            <Link to="/login">{copy.verify.restart}</Link>
          </Button>
        ) : (
          <Button
            size="lg"
            className="w-full"
            disabled={status === "verifying"}
            onClick={() => void verify()}
          >
            {status === "verifying" && <Loader2Icon className="animate-spin" />}
            {copy.verify.submit}
          </Button>
        )}
      </div>
    </AuthShell>
  );
}
