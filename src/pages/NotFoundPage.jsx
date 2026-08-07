/**
 * 404 page for unmatched routes.
 */

import { Link } from 'react-router-dom'

import { ROUTE_PATHS } from '@/routes/paths'

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="font-mono text-sm font-semibold text-brand-600">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
        Page not found
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        The page you requested does not exist or has been moved.
      </p>
      <Link
        to={ROUTE_PATHS.ROOT}
        className="mt-6 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
      >
        Back to overview
      </Link>
    </div>
  )
}

export default NotFoundPage
