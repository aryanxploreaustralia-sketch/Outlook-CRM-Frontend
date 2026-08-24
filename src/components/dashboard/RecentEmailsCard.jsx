/**
 * The five most recent messages.
 *
 * Reads from the dashboard payload rather than fetching separately — the counts
 * and this list have to agree, and two requests could disagree if a send lands
 * between them.
 */

import { Link } from 'react-router-dom'
import { ArrowRight, Inbox, Paperclip, PenSquare } from 'lucide-react'

import { MailStatusBadge } from '@/components/mail/MailStatusBadge'
import { ROUTE_PATHS } from '@/routes/paths'
import { formatDate, formatDateTime } from '@/utils/datetime'

/**
 * Formats a timestamp as a short relative age.
 *
 * "3h ago" answers the question a dashboard reader actually has — is this
 * recent? — which an absolute time makes them compute for themselves. The full
 * timestamp stays available as a tooltip.
 */
function formatRelative(value) {
  if (!value) return '—'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d ago`

  return formatDate(date)
}

/**
 * @param {{ items?: object[] }} props
 */
export function RecentEmailsCard({ items = [] }) {
  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
      <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">Recent emails</h2>
          <p className="mt-0.5 text-xs text-slate-500">Your five most recent messages</p>
        </div>

        {items.length > 0 && (
          <Link
            to={ROUTE_PATHS.MAIL}
            className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50"
          >
            View all
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        )}
      </header>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-5 py-8 text-center">
          <Inbox className="size-7 text-slate-300" aria-hidden="true" />
          <p className="mt-2.5 text-sm font-medium text-slate-700">No messages yet</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Messages you send will appear here.
          </p>
          <Link
            to={ROUTE_PATHS.COMPOSE}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-700"
          >
            <PenSquare className="size-3.5" aria-hidden="true" />
            Compose a message
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((mail) => (
            <li key={mail.id}>
              <Link
                to={ROUTE_PATHS.MAIL}
                className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {mail.subject?.trim() || '(no subject)'}
                    </p>
                    {mail.attachmentCount > 0 && (
                      <Paperclip
                        className="size-3 shrink-0 text-slate-400"
                        aria-label={`${mail.attachmentCount} attachment(s)`}
                      />
                    )}
                  </div>

                  <p className="truncate text-xs text-slate-500">
                    {mail.to?.join(', ') || '—'}
                  </p>
                </div>

                <span
                  className="hidden shrink-0 text-xs text-slate-400 sm:block"
                  title={formatDateTime(mail.sentAt ?? mail.createdAt)}
                >
                  {formatRelative(mail.sentAt ?? mail.createdAt)}
                </span>

                <MailStatusBadge status={mail.status} size="sm" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default RecentEmailsCard
