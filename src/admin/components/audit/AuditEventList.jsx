/**
 * A compact audit feed, scoped to one thing.
 *
 * The same component serves the four "recent events" strips the brief asks for
 * — on a user, a mailbox, a campaign, and the system page. Each passes a
 * different filter and gets the same rendering, which is the point: an operator
 * who has learned to read the feed on one page can read it on all of them.
 *
 * ## It fetches its own data, lazily
 *
 * Each strip lives well down a page the reader may never scroll. Fetching at
 * mount would put four extra queries on every page load for a section most
 * visits never see, so the host passes `enabled` and the request waits.
 *
 * ## An empty feed is a real answer
 *
 * "Nothing has been recorded for this mailbox" is information, and it is shown
 * as a sentence rather than as an empty box or a permanent spinner. It is also
 * distinguished from "you cannot see this" — a reader without `audit.view` is
 * told so explicitly rather than shown an empty list that implies nothing ever
 * happened.
 */

import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'

import { AdminEmptyState } from '@/admin/components/AdminEmptyState'
import { AdminErrorState } from '@/admin/components/AdminErrorState'
import { AdminListLoading } from '@/admin/components/AdminLoadingState'
import { AuditResultBadge } from '@/admin/components/audit/AuditPrimitives'
import { PERMISSIONS } from '@/admin/constants/permissions'
import { useAdminResource } from '@/admin/hooks/useAdminResource'
import { usePermission } from '@/admin/hooks/usePermissions'
import { fetchAuditLogs } from '@/admin/services/admin.service'
import { formatRelative } from '@/admin/utils/format'

/**
 * @param {{
 *   filter: object,          Server-side filter, e.g. `{ actor: id }`.
 *   limit?: number,
 *   enabled?: boolean,
 *   emptyMessage?: string,
 *   onSelect?: (entry: object) => void,
 *   viewAllTo?: string,      Where "view all" links, with the filter applied.
 * }} props
 */
export function AuditEventList({
  filter,
  limit = 10,
  enabled = true,
  emptyMessage = 'Nothing has been recorded yet.',
  onSelect,
  viewAllTo,
}) {
  const canSee = usePermission(PERMISSIONS.AUDIT_VIEW)

  const loader = useCallback(
    (options) => fetchAuditLogs({ ...filter, limit, ...options }),
    // Serialised so a fresh object literal from the host does not refetch on
    // every render — the same reason `useAdminResource` hashes its own deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(filter), limit],
  )

  const { data, error, isLoading, refresh } = useAdminResource(loader, {
    deps: [filter, limit],
    enabled: canSee && enabled,
  })

  if (!canSee) {
    return (
      <p className="text-sm text-slate-500">
        Reading the audit log requires the &ldquo;Read the audit log&rdquo; permission.
      </p>
    )
  }

  if (error) return <AdminErrorState error={error} onRetry={refresh} compact />
  if (isLoading) return <AdminListLoading rows={4} />

  const items = data?.items ?? []

  if (items.length === 0) {
    return <AdminEmptyState title="No recorded activity" description={emptyMessage} compact />
  }

  return (
    <div className="space-y-1">
      <ol className="divide-y divide-slate-100">
        {items.map((entry) => (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => onSelect?.(entry)}
              disabled={!onSelect}
              className={`flex w-full items-start gap-3 py-2.5 text-left ${
                onSelect ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default'
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-800">
                  <span className="font-medium">{entry.actionLabel}</span>
                  {entry.target?.name && (
                    <span className="text-slate-600"> — {entry.target.name}</span>
                  )}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {entry.actor?.email ?? 'Unknown user'} · {formatRelative(entry.occurredAt)}
                  {entry.ip ? ` · ${entry.ip}` : ''}
                </p>
              </div>

              {/* Only shown when it is not a plain success — a column of green
                  "Success" badges is noise that trains the eye to skip it. */}
              {entry.result !== 'success' && (
                <AuditResultBadge result={entry.result} reason={entry.resultReason} />
              )}
            </button>
          </li>
        ))}
      </ol>

      {viewAllTo && (
        <Link
          to={viewAllTo}
          className="inline-flex items-center gap-1 pt-2 text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          View in the audit log
          <ArrowUpRight className="size-3" aria-hidden="true" />
        </Link>
      )}
    </div>
  )
}

export default AuditEventList
