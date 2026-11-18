import { defineConfig } from "vitest/config";
// `loadEnv` lives only in "vite"; "vitest/config" re-exports `defineConfig`, not it.
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import mkcert from "vite-plugin-mkcert";
import { VitePWA } from "vite-plugin-pwa";

const host = process.env.TAURI_DEV_HOST;
// `bun run android`: the phone reaches this server and the local API (`wrangler dev`, Stripe test
// mode) through `adb reverse`. Tauri serves the app as http://tauri.localhost by intercepting
// requests, and Android's interception drops POST bodies, so the app calls the API directly.
const mobileDev = /android|ios/.test(process.env.TAURI_ENV_PLATFORM ?? "");

// Dev API proxy: the https (mkcert) page calling the http worker on :8787 is mixed content. bd Dailify-6aq
const apiTarget = (mode: string) =>
  loadEnv(mode, path.resolve(__dirname), "VITE_").VITE_API_URL || "http://localhost:8787";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    // mkcert installs a local CA (needs sudo) — skip under vitest. A phone doesn't trust that CA,
    // so `tauri android|ios dev` serves plain http (devUrl in tauri.android.conf.json).
    ...(process.env.VITEST || mobileDev ? [] : [mkcert()]),

    // Without a service worker the app can't open offline; `autoUpdate` swaps versions without a prompt.
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icons/*.png", "push-sw.js"],
      // Dev SW only with `PWA_DEV=1` (always on, it broke Firefox); `classic` for importScripts.
      devOptions: { enabled: !!process.env.PWA_DEV, type: "classic", suppressWarnings: true },
      manifest: {
        name: "Mewki",
        short_name: "Mewki",
        description: "Sua agenda do dia, escrita como você fala.",
        lang: "pt-BR",
        start_url: "/dashboard",
        display: "standalone",
        // --canvas escuro (global.css): dark é o tema principal. Ícones: `bun scripts/icons.ts`.
        background_color: "#000000",
        theme_color: "#000000",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: "/icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // One service worker: the push handlers join the generated one instead of fighting for scope.
        importScripts: ["/push-sw.js"],
        skipWaiting: true,
        clientsClaim: true,
        // Shell only: the landing's images pushed the precache to ~7.8MB.
        globPatterns: ["**/*.{js,css,html,woff2}"],
        // /api stays out of the SPA fallback, or an offline API call would get index.html back.
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/],
      },
    }),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  test: {
    // RTL needs the globals to set the act environment and register auto-cleanup.
    globals: true,
    // jsdom is opt-in per file (`@vitest-environment jsdom`); vitest 4 dropped environmentMatchGlobs.
    environment: "node",
    setupFiles: ["./src/test/setup.ts"],
    // Node >= 25's global `localStorage` would shadow jsdom's in render tests.
    execArgv: ["--no-experimental-webstorage"],
  },

  define: {
    "import.meta.env.VITE_DEV_API": JSON.stringify(mobileDev ? "http://127.0.0.1:8787" : "/api"),
  },

  clearScreen: false,

  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
    proxy: {
      "/api": {
        target: apiTarget(mode),
        changeOrigin: true,
        secure: false,
        rewrite: (p: string) => p.replace(/^\/api/, ""),
      },
    },
  },
}));
