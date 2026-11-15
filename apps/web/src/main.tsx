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
        existem aqui, e o app não tem catch-all: seria uma página branca. */}
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} signInUrl="/login" signUpUrl="/signup">
      <App />
    </ClerkProvider>
  </React.StrictMode>,
);
