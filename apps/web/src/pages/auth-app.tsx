import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { useSearchParams } from "react-router-dom";
import { parseUserAgent } from "@dailify/shared";

import { copy } from "@/components/auth/copy";
import { HandoffNotice, useOpenOnce } from "@/components/auth/handoff";

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

  const showOpen = !mobile && deepLink ? deepLink : null;
  useOpenOnce(showOpen);

  const message = !token ? copy.verify.invalid : mobile ? copy.app.mobile : copy.app.desktop;

  return (
    <HandoffNotice
      message={message}
      open={showOpen ? { href: showOpen, label: copy.app.open } : undefined}
      browser={{ to: "/login", label: copy.app.browser }}
    >
      <Helmet>
        <title>{copy.app.pageTitle}</title>
      </Helmet>
    </HandoffNotice>
  );
}
