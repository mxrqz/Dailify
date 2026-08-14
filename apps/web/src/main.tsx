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
