/**
 * One audit entry, in full.
 *
 * A drawer rather than a route, unlike the user 360 in Phase 14.5.1. The
 * difference is what the reader is doing: a user dashboard is a destination
 * somebody links to and returns to, while an audit entry is read *while
 * scanning the log* — and navigating away loses the filter, the scroll position
 * and the reader's place in a list they were working down.
 *
 * ## The row is not enough
 *
 * The list is fetched with a projection the table can render. Opening an entry
 * refetches it by id, because the detail view shows the request context and the
 * metadata — fields the table never displays, and which would otherwise be
 * carried for a hundred rows to be read on one.
 *
 * ## Related links
 *
 * Where an entry names a mailbox, a campaign or a person, the drawer offers a
 * way to see everything else that touched it. That is the query an audit log
 * exists to answer and it is one click rather than a filter the reader has to
 * reconstruct by hand.
 */

import { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'

import { AdminDrawer } from '@/admin/components/AdminDrawer'
import { AdminErrorState } from '@/admin/components/AdminErrorState'
import { AdminListLoading } from '@/admin/components/AdminLoadingState'
import {
  AuditJsonViewer,
  AuditResultBadge,
  AuditSeverityBadge,
} from '@/admin/components/audit/AuditPrimitives'
import { auditLinkFor } from '@/admin/constants/audit.constants'
import { useAdminResource } from '@/admin/hooks/useAdminResource'
import { ADMIN_PATHS } from '@/admin/routes/adminPaths'
import { fetchAuditEntry } from '@/admin/services/admin.service'
import { EMPTY, formatDateTime } from '@/admin/utils/format'

/** One labelled fact. `dt`/`dd` because that is what these are. */
function Fact({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-slate-800">{children ?? EMPTY}</dd>
    </div>
  )
}

export function AuditDetailDrawer({ entryId, isOpen, onClose }) {
  const loader = useCallback((options) => fetchAuditEntry(entryId, options), [entryId])

  const { data, error, isLoading, refresh } = useAdminResource(loader, {
    deps: [entryId],
    enabled: Boolean(entryId) && isOpen,
  })

  return (
    <AdminDrawer
      isOpen={isOpen}
      onClose={onClose}
      title={data?.actionLabel ?? 'Audit entry'}
      description={data ? formatDateTime(data.occurredAt) : undefined}
    >
      {error ? (
        <AdminErrorState error={error} onRetry={refresh} />
      ) : isLoading || !data ? (
        <AdminListLoading rows={8} />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            <AuditResultBadge result={data.result} reason={data.resultReason} />
            <AuditSeverityBadge severity={data.severity} />
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {data.categoryLabel}
            </span>
          </div>

          <p className="text-sm text-slate-700">{data.summary}</p>

          {data.resultReason && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {data.resultReason}
            </p>
          )}

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Who
            </h3>
            <dl className="grid grid-cols-2 gap-4">
              <Fact label="User">{data.actor?.email}</Fact>
              {/* Labelled "at the time" because it is: the role is captured on
                  write, so a later promotion does not rewrite this entry. */}
              <Fact label="Role at the time">{data.actor?.role}</Fact>
              {data.performedFor && <Fact label="Performed for">{data.performedFor.email}</Fact>}
            </dl>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              What
            </h3>
            <dl className="grid grid-cols-2 gap-4">
              <Fact label="Action">{data.actionLabel}</Fact>
              <Fact label="Target type">{data.target?.type}</Fact>
              <Fact label="Target">{data.target?.name ?? data.target?.id}</Fact>
              {data.affectedCount > 0 && (
                <Fact label="Records affected">{data.affectedCount}</Fact>
              )}
              {data.durationMs !== null && <Fact label="Duration">{data.durationMs} ms</Fact>}
            </dl>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Where
            </h3>
            <dl className="grid grid-cols-2 gap-4">
              <Fact label="IP address">{data.ip}</Fact>
              <Fact label="Device">{data.device}</Fact>
              <Fact label="Request">
                {data.request?.method ? `${data.request.method} ${data.request.path ?? ''}` : null}
              </Fact>
              <Fact label="Request ID">{data.request?.requestId}</Fact>
            </dl>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Detail
            </h3>
            <AuditJsonViewer value={data.metadata} />
            <p className="mt-2 text-xs text-slate-400">
              Credentials are removed before an entry is stored. A{' '}
              <code className="text-slate-500">[redacted]</code> marker means a field was present
              and its value was destroyed.
            </p>
          </section>

          {/* Related — only rendered when there is something to relate to. */}
          {(data.refs?.mailboxId ||
            data.refs?.campaignId ||
            data.refs?.leadId ||
            data.actor?.id) && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Related
              </h3>
              <ul className="space-y-1.5">
                {[
                  data.actor?.id && {
                    to: auditLinkFor({ actor: data.actor.id }),
                    label: `Everything ${data.actor.email ?? 'this user'} has done`,
                  },
                  data.actor?.id && {
                    to: ADMIN_PATHS.USER_DETAIL.replace(':id', data.actor.id),
                    label: 'Open this user’s dashboard',
                  },
                  data.refs?.mailboxId && {
                    to: auditLinkFor({ mailboxId: data.refs.mailboxId }),
                    label: 'Everything that touched this mailbox',
                  },
                  data.refs?.campaignId && {
                    to: auditLinkFor({ campaignId: data.refs.campaignId }),
                    label: 'Everything that touched this campaign',
                  },
                  data.refs?.leadId && {
                    to: auditLinkFor({ leadId: data.refs.leadId }),
                    label: 'Everything that touched this enquiry',
                  },
                ]
                  .filter(Boolean)
                  .map((link) => (
                    <li key={link.to}>
                      <Link
                        to={link.to}
                        onClick={onClose}
                        className="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700"
                      >
                        {link.label}
                        <ArrowUpRight className="size-3" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          )}

          {data.isLegacyEntry && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              This entry was recorded before the extended audit fields existed, so some of the
              detail above was never captured. It is not missing data — it was never collected.
            </p>
          )}
        </div>
      )}
    </AdminDrawer>
  )
}

export default AuditDetailDrawer
