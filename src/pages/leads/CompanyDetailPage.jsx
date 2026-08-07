/**
 * One company: its people, its enquiries and its pipeline shape.
 */

import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, Mail } from 'lucide-react'

import { LeadStageBadge } from '@/components/leads/LeadStageBadge'
import { ErrorScreen } from '@/components/common/ErrorScreen'
import { Spinner } from '@/components/ui/Spinner'
import { COMPANY_STATUS_STYLES, LEAD_STAGES } from '@/constants/lead.constants'
import { useCompany } from '@/hooks/useLeads'
import { ROUTE_PATHS } from '@/routes/paths'
import { resolveErrorVariant } from '@/utils/apiError'

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : '—')

export function CompanyDetailPage() {
  const { id } = useParams()
  const { company, contacts, leads, byStage, isInitialLoading, isError, error, refresh } = useCompany(id)

  if (isInitialLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading the company" />
      </div>
    )
  }

  if (isError || !company) {
    return <ErrorScreen variant={resolveErrorVariant(error)} error={error} onRetry={() => refresh()} />
  }

  const status = COMPANY_STATUS_STYLES[company.status] ?? COMPANY_STATUS_STYLES.active
  const stagesPresent = LEAD_STAGES.filter((stage) => (byStage[stage.value] ?? 0) > 0)

  return (
    <div className="space-y-5">
      <div>
        <Link to={ROUTE_PATHS.COMPANIES} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          All companies
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Building2 className="size-5 text-slate-400" aria-hidden="true" />
          <h1 className="text-lg font-semibold text-slate-900">{company.companyName}</h1>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${status.className}`}>
            {status.label}
          </span>
        </div>
        {company.emailDomain && <p className="mt-0.5 font-mono text-xs text-slate-400">{company.emailDomain}</p>}
      </div>

      {/* --- Summary ------------------------------------------------------- */}
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Enquiries', company.leadCount.toLocaleString()],
          ['People', company.contactCount.toLocaleString()],
          ['Last enquiry', formatDate(company.lastLeadAt)],
          ['Location', [company.city, company.state, company.country].filter(Boolean).join(', ') || '—'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="mt-1 text-xl font-semibold text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>

      {company.aliases?.length > 0 && (
        <p className="rounded-lg bg-slate-50 px-4 py-2.5 text-sm text-slate-600 ring-1 ring-inset ring-slate-200">
          Also spelled in the source sheet as{' '}
          <span className="font-medium">{company.aliases.join(', ')}</span>. These were merged because
          they share the same email domain.
        </p>
      )}

      {/* --- Pipeline shape ------------------------------------------------ */}
      {stagesPresent.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">Pipeline</h2>
          <ul className="mt-3 space-y-2">
            {stagesPresent.map((stage) => (
              <li key={stage.value} className="flex items-center gap-3">
                <span className="w-28 shrink-0">
                  <LeadStageBadge stage={stage.value} />
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${((byStage[stage.value] ?? 0) / Math.max(1, company.leadCount)) * 100}%` }}
                  />
                </div>
                <span className="w-10 text-right text-sm tabular-nums text-slate-600">{byStage[stage.value]}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* --- People ----------------------------------------------------- */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">People ({contacts.length})</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {contacts.map((contact) => (
              <li key={contact.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-900">{contact.displayName ?? contact.primaryEmail}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-slate-500">
                    <Mail className="size-3 text-slate-400" aria-hidden="true" />
                    {contact.primaryEmail}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-slate-400">{contact.leadCount ?? 0} enquiries</span>
              </li>
            ))}
            {contacts.length === 0 && <li className="py-6 text-center text-sm text-slate-400">No contacts.</li>}
          </ul>
        </section>

        {/* --- Enquiries --------------------------------------------------- */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Recent enquiries</h2>
            <Link to={`${ROUTE_PATHS.LEADS}?company=${company.id}`} className="text-xs text-blue-600 hover:underline">
              View all {company.leadCount.toLocaleString()}
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-slate-100">
            {leads.map((lead) => (
              <li key={lead.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <Link
                    to={ROUTE_PATHS.LEAD_DETAIL.replace(':id', lead.id)}
                    className="font-mono text-xs text-blue-600 hover:underline"
                  >
                    {lead.reference}
                  </Link>
                  <p className="truncate text-xs text-slate-500">
                    {lead.contactPerson} · {lead.city ?? '—'} · {formatDate(lead.quoteDate)}
                  </p>
                </div>
                <LeadStageBadge stage={lead.stage} />
              </li>
            ))}
            {leads.length === 0 && <li className="py-6 text-center text-sm text-slate-400">No enquiries.</li>}
          </ul>
        </section>
      </div>
    </div>
  )
}

export default CompanyDetailPage
