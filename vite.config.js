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

  /*
   * A production build must name the API host explicitly.
   *
   * ## The failure this prevents
   *
   * With `VITE_API_BASE_URL` unset, `resolveApiBaseUrl` falls back to
   * same-origin — correct for a reverse proxy serving both apps from one host,
   * and silently wrong for this deployment, where the API lives on
   * crmbackend.xploreaustralia.com. The bundle then asks
   * crm.xploreaustralia.com for /api/v1/... and every request 404s.
   *
   * Nothing about that failure announces itself at build time, and
   * `.env.production` is gitignored — so the file exists on whichever machine
   * happened to create it and on no other. A build from a fresh clone, a new
   * laptop or CI produces a broken bundle that looks identical to a good one.
   * That is what makes it read as "works on one network, not another": it
   * depends on where the bundle was *built*, not where it is opened.
   *
   * A private or loopback host is rejected for the same reason, one step more
   * obviously: such a bundle works only for browsers on that LAN.
   *
   * Development is untouched — this runs only for `mode === 'production'`,
   * where an empty value has no legitimate meaning for this deployment.
   */
  if (mode === 'production') {
    const base = String(env.VITE_API_BASE_URL ?? '').trim()

    // Loopback, link-local, and the three RFC 1918 ranges.
    const PRIVATE_HOST =
      /^(localhost|127\.|0\.0\.0\.0|\[?::1\]?|169\.254\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i

    if (base === '') {
      throw new Error(
        [
          'VITE_API_BASE_URL is not set for the production build.',
          'Without it the bundle calls its own origin for /api, which is not where this API lives.',
          'Set it in frontend/.env.production (or the CI environment), origin only:',
          '    VITE_API_BASE_URL="https://crmbackend.xploreaustralia.com"',
        ].join('\n'),
      )
    }

    let host
    try {
      host = new URL(base).hostname
    } catch {
      throw new Error(`VITE_API_BASE_URL is not a valid URL: "${base}"`)
    }

    if (PRIVATE_HOST.test(host)) {
      throw new Error(
        [
          `VITE_API_BASE_URL points at a private or loopback host: "${host}".`,
          'A bundle built this way only works for browsers on that network.',
          'Use the public API origin: https://crmbackend.xploreaustralia.com',
        ].join('\n'),
      )
    }
  }

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
