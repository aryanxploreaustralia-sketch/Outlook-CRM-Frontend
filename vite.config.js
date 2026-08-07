import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

/**
 * Vite configuration for the Outlook Automation CRM frontend.
 *
 * `loadEnv` is used instead of `process.env` so that the dev-server proxy can be
 * pointed at a different backend host per environment without editing this file.
 *
 * @see https://vite.dev/config/
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const devPort = Number(env.VITE_DEV_PORT ?? 5173)
  const proxyTarget = env.VITE_DEV_PROXY_TARGET ?? 'http://localhost:5000'

  return {
    plugins: [react(), tailwindcss()],

    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },

    server: {
      port: devPort,
      // Fail loudly instead of silently hopping to a random port, so the
      // documented URL is always the real one.
      strictPort: true,
      proxy: {
        // Lets the browser call a same-origin `/api/...` in development,
        // which sidesteps CORS entirely while keeping production URLs absolute.
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },

    preview: {
      port: Number(env.VITE_PREVIEW_PORT ?? 4173),
      strictPort: true,
    },

    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      chunkSizeWarningLimit: 1000,
    },
  }
})
