/**
 * One company: its people, its enquiries and its pipeline shape.
 */

import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, Mail, Pencil, Trash2 } from 'lucide-react'

import { LeadStageBadge } from '@/components/leads/LeadStageBadge'
import { RemarkCell } from '@/components/leads/RemarkCell'
import { ErrorScreen } from '@/components/common/ErrorScreen'
import { Spinner } from '@/components/ui/Spinner'
import { Button } from '@/components/ui/Button'
import { deleteCompany, updateCompany } from '@/api/services/lead.service'
import { COMPANY_STATUS_STYLES, LEAD_STAGES } from '@/constants/lead.constants'
import { useCompany } from '@/hooks/useLeads'
import { ROUTE_PATHS } from '@/routes/paths'
import { resolveErrorVariant } from '@/utils/apiError'

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : '—')

export function CompanyDetailPage() {
  const { id } = useParams()
  const { company, contacts, leads, byStage, isInitialLoading, isError, error, refresh } = useCompany(id)
  const navigate = useNavigate()

  /*
   * `draft` is null until Edit is pressed, and discarding is setting it back to
   * null — so Cancel cannot leave a half-typed value behind, and the view below
   * always renders the server's copy rather than a local mirror of it.
   */
  const [draft, setDraft] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [notice, setNotice] = useState(null)

  /*
   * Exactly the fields `companyUpdateSchema` accepts, in its order.
   *
   * Offering anything else would produce a form control whose value the server
   * silently discards — the identity fields (`owner`, `matchKey`, `aliases`,
   * the denormalised counts) are maintained by the importer and are not the
   * reader's to change.
   */
  const FIELDS = [
    { key: 'companyName', label: 'Company name', required: true },
    { key: 'companyCode', label: 'Company code' },
    { key: 'city', label: 'City' },
    { key: 'state', label: 'State' },
    { key: 'country', label: 'Country' },
    { key: 'website', label: 'Website' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'gstNumber', label: 'GST number' },
  ]

  const startEdit = () => {
    setNotice(null)
    setDraft(
      Object.fromEntries([
        ...FIELDS.map((field) => [field.key, company?.[field.key] ?? '']),
        ['status', company?.status ?? 'active'],
        ['notes', company?.notes ?? ''],
      ]),
    )
  }

  const save = async () => {
    setIsSaving(true)
    try {
      // Blanks go up as null, which the schema accepts as "clear this" —
      // sending '' would store an empty string and read as a value that is there.
      const payload = Object.fromEntries(
        Object.entries(draft).map(([key, value]) =>
          key === 'status' ? [key, value] : [key, String(value ?? '').trim() || null],
        ),
      )

      await updateCompany(id, payload)
      setDraft(null)
      setNotice({ tone: 'success', text: 'Company updated.' })
      // The existing hook re-reads the detail; nothing is patched locally.
      refresh()
    } catch (thrown) {
      setNotice({ tone: 'error', text: thrown?.message ?? 'That change could not be saved.' })
    } finally {
      setIsSaving(false)
    }
  }

  const remove = async () => {
    setIsDeleting(true)
    try {
      await deleteCompany(id)
      // Back to the register, which refetches on mount — the deleted company is
      // gone from it without anything here having to invalidate a cache.
      navigate(ROUTE_PATHS.COMPANIES, { replace: true })
    } catch (thrown) {
      setNotice({ tone: 'error', text: thrown?.message ?? 'That company could not be deleted.' })
      setConfirmDelete(false)
    } finally {
      setIsDeleting(false)
    }
  }

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

          {/* Hidden while editing: the form carries its own Save and Cancel,
              and a second Edit beside them is a control with nothing to do. */}
          {!draft && (
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" size="sm" onClick={startEdit}>
                <Pencil className="size-3.5" aria-hidden="true" />
                Edit
              </Button>
              <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-3.5" aria-hidden="true" />
                Delete
              </Button>
            </div>
          )}
        </div>
        {company.emailDomain && <p className="mt-0.5 font-mono text-xs text-slate-400">{company.emailDomain}</p>}
      </div>

      {notice && (
        <div
          role="status"
          className={`flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm ${
            notice.tone === 'error'
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900'
          }`}
        >
          <p className="min-w-0 flex-1">{notice.text}</p>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="shrink-0 rounded px-2 py-0.5 text-xs font-medium hover:bg-white/60"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* --- Edit ---------------------------------------------------------- */}
      {draft && (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            save()
          }}
          className="rounded-xl border border-slate-200 bg-white p-5"
        >
          <h2 className="text-sm font-semibold text-slate-900">Edit company</h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {FIELDS.map((field) => (
              <label key={field.key} className="text-xs font-medium text-slate-600">
                {field.label}
                {field.required && <span className="text-red-600"> *</span>}
                <input
                  type="text"
                  required={field.required}
                  value={draft[field.key] ?? ''}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, [field.key]: event.target.value }))
                  }
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </label>
            ))}

            <label className="text-xs font-medium text-slate-600">
              Status
              <select
                value={draft.status}
                onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value }))}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              >
                {/* The same vocabulary the badge above renders, so the form
                    cannot offer a status the page has no styling for. */}
                {Object.entries(COMPANY_STATUS_STYLES).map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-medium text-slate-600 sm:col-span-2">
              Notes
              <textarea
                rows={3}
                value={draft.notes ?? ''}
                onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </label>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setDraft(null)} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="submit" size="sm" isLoading={isSaving} disabled={isSaving}>
              Save changes
            </Button>
          </div>
        </form>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-6">
          <div className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl">
            <h2 className="text-base font-semibold text-slate-900">Delete this company?</h2>
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{company.companyName}</span> will be removed
              from the register. This action cannot be undone.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Its {company.leadCount?.toLocaleString() ?? 0} enquiry/enquiries are kept.
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)} disabled={isDeleting}>
                Cancel
              </Button>
              <Button variant="danger" size="sm" onClick={remove} isLoading={isDeleting} disabled={isDeleting}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

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
                    {/* Travel date leads the listing; prose values like "August"
                        are shown as written. */}
                    {lead.contactPerson} ·{' '}
                    {lead.travelDate ? formatDate(lead.travelDate) : (lead.travelDateText ?? '—')}
                    {lead.internalNotes && (
                      <>
                        {' · '}
                        <RemarkCell
                          variant="inline"
                          remarks={lead.internalNotes}
                          reference={lead.reference}
                          emptyFallback={null}
                        />
                      </>
                    )}
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
