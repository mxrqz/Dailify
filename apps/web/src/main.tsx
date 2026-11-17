import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

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
    <App />
  </React.StrictMode>,
);
