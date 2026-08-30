import { defineConfig } from "vitest/config";
// `loadEnv` só existe no "vite"; o "vitest/config" reexporta `defineConfig`, não ele.
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import mkcert from 'vite-plugin-mkcert'
import { VitePWA } from 'vite-plugin-pwa'

const host = process.env.TAURI_DEV_HOST;

// Proxy de API em dev: HTTPS (mkcert) -> HTTP (wrangler :8787) seria mixed content. bd Dailify-6aq
const apiTarget = (mode: string) =>
  loadEnv(mode, path.resolve(__dirname), "VITE_").VITE_API_URL || "http://localhost:8787";

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    // mkcert installs a local CA (needs sudo) — skip under vitest
    ...(process.env.VITEST ? [] : [mkcert()]),

    // Sem service worker o app nem abre sem rede, e todo o cache local do `functions/offline.ts`
    // ficaria inalcançável. `autoUpdate`: versão nova entra sozinha, sem prompt — o app é de uso
    // diário e um "recarregue" na cara do usuário é pedágio.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['dailify_logo_2.png'],
      manifest: {
        name: 'Dailify',
        short_name: 'Dailify',
        description: 'Sua agenda do dia, escrita como você fala.',
        lang: 'pt-BR',
        start_url: '/dashboard',
        display: 'standalone',
        background_color: '#0a0a0a',
        theme_color: '#0a0a0a',
        icons: [
          { src: '/dailify_logo_2.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        ],
      },
      workbox: {
        // Só o shell: com png/jpg dentro, o precache subia pra ~7.8MB por causa das imagens da
        // landing — megabytes baixados no 3G de quem só queria abrir a agenda.
        globPatterns: ['**/*.{js,css,html,woff2}'],
        // O SPA responde qualquer rota pelo index; a API fica de fora do fallback, senão um
        // /api offline devolveria HTML no lugar do erro que o cliente sabe tratar.
        navigateFallback: '/index.html',
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
    globals: true,
    environment: "node",
  },

  clearScreen: false,
  
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    // allowedHosts: ["8032-2804-317c-731e-3a00-7d8e-96bc-489f-600.ngrok-free.app"],
    hmr: host
      ? {
        protocol: "ws",
        host,
        port: 1421,
      }
      : undefined,
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
