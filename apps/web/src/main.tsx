import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ClerkProvider } from "@clerk/clerk-react";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}

// O clerk-js vem do Frontend API, cujo host está dentro da chave (`pk_<env>_<base64(host$)>`).
// Abrir a conexão (DNS+TLS) agora, antes do provider montar e injetar o <script crossorigin>.
// O formato é conferido: chave estranha só perde o preconnect, nunca quebra o boot.
try {
  const host = atob(PUBLISHABLE_KEY.split("_")[2] ?? "").slice(0, -1);
  if (/^[a-z0-9.-]+$/i.test(host)) {
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = `https://${host}`;
    link.crossOrigin = "anonymous";
    document.head.append(link);
  }
} catch {
  /* chave sem base64 válido: segue sem preconnect */
}

// Deploy novo troca os hashes e o SW apaga o precache velho: a aba aberta há horas pede uma rota
// lazy que não existe mais. Recarrega pro index novo; o piso de 10s impede loop se o chunk quebrou.
window.addEventListener("vite:preloadError", () => {
  if (Date.now() - Number(sessionStorage.getItem("chunk-reload")) < 10_000) return;
  sessionStorage.setItem("chunk-reload", String(Date.now()));
  window.location.reload();
});

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Missing #root element");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    {/* Sem estas duas, o clerk-js navega sozinho pros defaults /sign-in e /sign-up — rotas que não
        existem aqui, e o app não tem catch-all: seria uma página branca.
        `headless`: só hooks e control components (`AuthenticateWithRedirectCallback`) são usados —
        nenhuma UI pronta nem `open*` — então o bundle sem os componentes basta. */}
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      signInUrl="/login"
      signUpUrl="/signup"
      clerkJSVariant="headless"
    >
      <App />
    </ClerkProvider>
  </React.StrictMode>,
);
