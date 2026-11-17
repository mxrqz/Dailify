/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// User-Agent Client Hints: só Chromium tem (o lib.dom ainda não tipa). kit/refraction.tsx usa.
interface Navigator {
  readonly userAgentData?: { readonly brands: readonly { readonly brand: string }[] };
}
