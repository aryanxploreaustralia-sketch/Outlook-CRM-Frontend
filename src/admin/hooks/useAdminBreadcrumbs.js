/**
 * Breadcrumb trail derived from the route.
 *
 * Uses `useMatches`, the same mechanism `DashboardLayout` already uses to read
 * page titles out of the route registry. Deriving the trail from the router
 * rather than hard-coding it per page means a breadcrumb can never name a page
 * that does not exist, and a route rename updates every trail that passes
 * through it.
 *
 * Routes declare `handle: { title, subtitle, breadcrumb }`. Only `breadcrumb`
 * is read here; the other two are read by the layout for the top bar.
 */

import { useMatches } from 'react-router-dom'

import { ADMIN_PATHS } from '@/admin/routes/adminPaths'

/** Every trail starts here, so the way back to the admin home is always one click. */
const ROOT_CRUMB = Object.freeze({ label: 'Administration', to: ADMIN_PATHS.DASHBOARD })

/**
 * @param {Array<{ label: string, to?: string }>} [extra]
 *   Appended after the route-derived trail, for crumbs only the page knows —
 *   a record's name on a detail screen, for instance.
 * @returns {Array<{ label: string, to?: string }>}
 */
export function useAdminBreadcrumbs(extra = []) {
  const matches = useMatches()

  const fromRoute = matches
    .filter((match) => match.handle?.breadcrumb)
    .map((match) => ({ label: match.handle.breadcrumb, to: match.pathname }))

  const trail = [ROOT_CRUMB, ...fromRoute, ...extra]

  // The admin index route's own crumb would duplicate the root. Dropped here
  // rather than omitted from the route, so the route registry stays uniform.
  const deduped = trail.filter(
    (crumb, index) => index === 0 || crumb.label !== trail[index - 1].label,
  )

  // The final crumb is the current page and must not be a link — a link to
  // where you already are is a dead control. `AdminBreadcrumb` also enforces
  // this, but stripping it here means the data is right, not just the rendering.
  return deduped.map((crumb, index) =>
    index === deduped.length - 1 ? { label: crumb.label } : crumb,
  )
}

export default useAdminBreadcrumbs
