/**
 * The Employee Performance section of User 360 (Phase 17.3).
 *
 * ## Its own date range
 *
 * The section carries a range control rather than inheriting the page's,
 * because User 360 has no page-level range and the rest of it is current-state:
 * role, identities, mailboxes. Performance is the only thing on the page that is
 * a *period*, so the period belongs to it.
 *
 * ## Deferred like every other heavy section
 *
 * Nine concurrent aggregations. Somebody who opened the page to check a role
 * should not pay for them, so the request waits until the section is scrolled
 * into view.
 */

import { useCallback, useState } from 'react'

import { AdminDateRange } from '@/admin/components/AdminDateRange'
import { AdminErrorState } from '@/admin/components/AdminErrorState'
import { PerformanceDashboard } from '@/admin/components/performance/PerformanceDashboard'
import { UserSection } from '@/admin/components/users/detail/UserDetailPrimitives'
import { useAdminResource } from '@/admin/hooks/useAdminResource'
import { fetchAdminUserPerformanceDashboard } from '@/admin/services/admin.service'

/**
 * @param {{
 *   user: object,
 *   registerRef: (id: string) => object,
 *   enabled?: boolean,
 * }} props
 */
export function UserPerformanceDashboardSection({ user, registerRef, enabled = true }) {
  const [range, setRange] = useState({ preset: 'last30' })

  const loader = useCallback(
    (options) => fetchAdminUserPerformanceDashboard(user.id, { ...options, range }),
    [user.id, range],
  )

  const { data, error, isLoading, refresh } = useAdminResource(loader, {
    deps: [user.id, range.preset, range.from, range.to],
    enabled,
  })

  return (
    <UserSection
      id="performance-dashboard"
      ref={registerRef('performance-dashboard')}
      title="Employee performance"
      description="Derived live from this person's mail, campaigns, enquiries and recorded actions. Nothing here is stored or estimated."
      /*
       * The section's action slot, not the page header. This period scopes
       * this section alone — the detail page above it has a dozen others it
       * does not touch — so it sits with the heading it governs, following
       * the same heading-left / period-right rule one level down.
       */
      action={<AdminDateRange value={range} onChange={setRange} resolved={data?.range} />}
    >
      <div className="space-y-4">
        {error ? (
          <AdminErrorState error={error} onRetry={refresh} compact />
        ) : (
          <PerformanceDashboard data={data} isLoading={isLoading} audience="admin" />
        )}
      </div>
    </UserSection>
  )
}

export default UserPerformanceDashboardSection
