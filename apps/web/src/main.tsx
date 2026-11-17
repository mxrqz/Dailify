import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import React from "react";
import ReactDOM from "react-dom/client";
import { toast } from "sonner";
import App from "./App";
import { copy } from "@/components/auth/copy";
import { initBackButton } from "@/lib/back-button";
import { initNativeAuth, isTauri } from "@/lib/native-auth";

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

const render = () =>
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );

// App: o bearer do cofre precisa estar posto antes do primeiro get-session e de qualquer `api.ts`.
// Link de login que falha chega depois do render, com o Toaster montado.
if (isTauri()) {
  initBackButton().catch(console.error);
  initNativeAuth((error) => {
    console.error(error);
    toast.error(copy.verify.invalid);
  })
    .catch(console.error)
    .finally(render);
} else {
  render();
}
