import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useSearchParams } from "react-router-dom";

import { AuthShell } from "@/components/auth/auth-shell";
import { copy } from "@/components/auth/copy";
import { Button } from "@/components/ui/button";
import { parseUserAgent } from "@/functions/user-agent";

/**
 * `/auth/app?token=…`: o link do e-mail pedido pelo app. No celular com o app, o sistema abre o
 * app antes desta página (Universal/App Links); chegar aqui no celular = app não instalado. No
 * desktop tenta o esquema `mewki://` uma vez. NUNCA chama verify: o token é amarrado ao `verifier`
 * do aparelho que pediu, então o navegador não teria como gastá-lo — ele recomeça pelo /login.
 */
export default function AuthApp() {
  const token = useSearchParams()[0].get("token");
  const [mobile] = useState(() => parseUserAgent(navigator.userAgent).mobile);
  const deepLink = token && `mewki://auth?token=${encodeURIComponent(token)}`;

  const showOpen = !mobile && deepLink;

  // Uma tentativa só (o StrictMode roda o efeito duas vezes): repetir empilha diálogos do sistema.
  const tried = useRef(false);
  useEffect(() => {
    if (!showOpen || tried.current) return;
    tried.current = true;
    window.location.href = showOpen;
  }, [showOpen]);

  const message = !token ? copy.verify.invalid : mobile ? copy.app.mobile : copy.app.desktop;

  return (
    <AuthShell>
      <Helmet>
        <title>{copy.app.pageTitle}</title>
      </Helmet>
      <div className="flex flex-col items-center gap-4 pt-24 text-center">
        <p className="text-body text-ink">{message}</p>

        {showOpen && (
          <Button asChild size="lg" className="w-full">
            <a href={showOpen}>{copy.app.open}</a>
          </Button>
        )}
        <Button asChild size="lg" variant="secondary" className="w-full">
          <Link to="/login">{copy.app.browser}</Link>
        </Button>
      </div>
    </AuthShell>
  );
}
