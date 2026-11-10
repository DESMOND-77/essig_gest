/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Le frontend est servi par Vite en dev et par Caddy en production.
// En dev, /api est proxifié vers Django : le navigateur ne parle qu'à une seule
// origine (pas de CORS, cookie refresh httpOnly same-origin). La cible du proxy
// est surchargeable via VITE_API_PROXY pour les environnements distants.
const apiProxy = process.env.VITE_API_PROXY || 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: Number(process.env.PORT || 5173),
    // Les previews Arena sont servies sous <port>-<sandbox>.e2b.app.
    allowedHosts: true,
    proxy: {
      '/api': {
        target: apiProxy,
        changeOrigin: false,
      },
      '/media': {
        target: apiProxy,
        changeOrigin: false,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: Number(process.env.PORT || 4173),
    allowedHosts: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
})
