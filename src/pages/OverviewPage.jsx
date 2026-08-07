/**
 * Overview page.
 *
 * Phase 1 landing page. It documents what the foundation currently provides and
 * what is intentionally not built yet, so anyone opening the app knows exactly
 * where the project stands. It is deliberately not a CRM dashboard.
 */

import { Link } from 'react-router-dom'

import { Card } from '@/components/common/Card'
import { env } from '@/config/env'
import { ROUTE_PATHS } from '@/routes/paths'

const FOUNDATION_READY = [
  'React 19 + Vite 8 with a strict, documented dev-server port',
  'Tailwind CSS v4 configured through the official Vite plugin',
  'React Router with a centralised route registry',
  'Axios client with correlation ids and normalised errors',
  'Express 5 API with Helmet, CORS, compression and rate limiting',
  'Mongoose connection with retry, health reporting and graceful shutdown',
  'Winston logger with daily-rotated files and request logging',
  'Centralised configuration validated at startup',
  'Microsoft OAuth 2.0 sign-in with PKCE and CSRF state validation',
  'Microsoft Graph client with transparent access-token refresh',
  'Revocable database sessions in signed, HTTP-only cookies',
  'Token caches encrypted at rest with AES-256-GCM',
  'Reusable dashboard shell with responsive sidebar and drawer navigation',
  'Protected routes, skeleton loading and reusable error states',
  'Authenticated dashboard, account and status APIs',
]

const NOT_YET_BUILT = [
  'Email sending and campaigns',
  'Excel/CSV contact upload',
  'Reply and open tracking',
  'CRM dashboard and reporting UI',
  'Contact and email data models',
  'BullMQ + Redis background workers',
]

export function OverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {env.appName}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Phase 3 &mdash; enterprise dashboard. Open the{' '}
          <Link
            to={ROUTE_PATHS.DASHBOARD}
            className="font-medium text-brand-600 underline-offset-2 hover:underline"
          >
            Dashboard
          </Link>{' '}
          to manage your Microsoft connection, or check service connectivity on the{' '}
          <Link
            to={ROUTE_PATHS.SYSTEM}
            className="font-medium text-brand-600 underline-offset-2 hover:underline"
          >
            System
          </Link>{' '}
          page.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card
          title="Foundation in place"
          description="Wired, running and verified."
        >
          <ul className="space-y-2">
            {FOUNDATION_READY.map((item) => (
              <li key={item} className="flex gap-2.5 text-sm text-slate-600">
                <span className="mt-0.5 text-green-600" aria-hidden="true">
                  &#10003;
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          title="Deliberately not built yet"
          description="Reserved for the phases that follow."
        >
          <ul className="space-y-2">
            {NOT_YET_BUILT.map((item) => (
              <li key={item} className="flex gap-2.5 text-sm text-slate-500">
                <span className="mt-0.5 text-slate-300" aria-hidden="true">
                  &#9679;
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}

export default OverviewPage
