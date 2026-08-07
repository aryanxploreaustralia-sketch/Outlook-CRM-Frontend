/**
 * Router-level error boundary page.
 *
 * React Router renders this whenever a route throws during render or data
 * loading. Without it the user sees a blank white screen and the stack trace is
 * lost, which is a painful way to debug a production incident.
 */

import { useRouteError } from 'react-router-dom'

import { env } from '@/config/env'
import { logger } from '@/utils/logger'

export function ErrorPage() {
  const error = useRouteError()
  logger.error('Unhandled routing error', error)

  const message =
    error?.statusText || error?.message || 'An unexpected error occurred while rendering this page.'

  return (
    <div className="mx-auto grid min-h-svh max-w-lg place-items-center px-6">
      <div className="text-center">
        <p className="font-mono text-sm font-semibold text-red-600">Error</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-slate-500">{message}</p>

        {/* Stack traces are useful locally but must never leak to end users. */}
        {env.isDevelopment && error?.stack && (
          <pre className="mt-6 overflow-x-auto rounded-lg bg-slate-900 p-4 text-left font-mono text-xs text-slate-200">
            {error.stack}
          </pre>
        )}

        <button
          type="button"
          onClick={() => window.location.assign('/')}
          className="mt-6 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
        >
          Reload application
        </button>
      </div>
    </div>
  )
}

export default ErrorPage
