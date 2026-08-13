import { defineConfig } from "vitest/config";
// `loadEnv` só existe no "vite"; o "vitest/config" reexporta `defineConfig`, não ele.
import { loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import mkcert from 'vite-plugin-mkcert'

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
