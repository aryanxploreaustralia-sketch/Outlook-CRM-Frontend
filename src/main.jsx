/**
 * Browser entry point.
 *
 * Mounts React onto the `#root` element declared in `index.html`.
 * StrictMode is enabled to surface unsafe lifecycles and side-effect bugs
 * during development; it has no effect on production builds.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from '@/App'
import { env } from '@/config/env'
import '@/styles/index.css'

const container = document.getElementById('root')

if (!container) {
  throw new Error('[bootstrap] Root element #root was not found in index.html.')
}

document.title = env.appName

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
