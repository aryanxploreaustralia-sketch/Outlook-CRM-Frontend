/**
 * One enquiry, with the company and person behind it.
 *
 * The stage control and the history sit together on purpose: "how long has this
 * been in negotiation" is only answerable if every transition is visible.
 */

import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Building2, Mail, Pencil, Phone, User } from 'lucide-react'

import { fetchLeadConversation } from '@/api/services/conversation.service'
import { LeadConversation } from '@/components/leads/LeadConversation'
import { LeadEditDialog } from '@/components/leads/LeadEditDialog'
import { LeadStageBadge } from '@/components/leads/LeadStageBadge'
import { ErrorScreen } from '@/components/common/ErrorScreen'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { LEAD_STAGES } from '@/constants/lead.constants'
import { useApiResource } from '@/hooks/useApiResource'
import { useLead } from '@/hooks/useLeads'
import { ROUTE_PATHS } from '@/routes/paths'
import { resolveErrorVariant } from '@/utils/apiError'

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : '—')

export function LeadDetailPage() {
  const { id } = useParams()
  const {
    lead, company, contact, canEdit,
    isInitialLoading, isError, error, refresh, action, isBusy, actionError, save, saveFull,
  } = useLead(id)

  const [notes, setNotes] = useState(null)

  /** Whether the edit dialog is open. The dialog owns the draft itself. */
  const [isEditOpen, setIsEditOpen] = useState(false)

  /**
   * The correspondence, fetched separately from the enquiry itself.
   *
   * Deliberately its own request: the enquiry record is small and renders
   * immediately, while the thread may carry a hundred messages and their
   * attachments. Blocking the whole page on the slower of the two would make
   * every enquiry feel as slow as the busiest one.
   */
  const conversationFetcher = useCallback(
    ({ signal }) => (id ? fetchLeadConversation(id, { signal }) : Promise.resolve(null)),
    [id],
  )
  const { data: correspondence, isInitialLoading: isConversationLoading } =
    useApiResource(conversationFetcher)

  if (isInitialLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading the enquiry" />
      </div>
    )
  }

  if (isError || !lead) {
    return <ErrorScreen variant={resolveErrorVariant(error)} error={error} onRetry={() => refresh()} />
  }

  const noteValue = notes ?? lead.internalNotes ?? ''

  return (
    <div className="space-y-5">
      {/* --- Header ------------------------------------------------------- */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={ROUTE_PATHS.LEADS} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            All enquiries
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-lg font-semibold text-slate-900">{lead.reference}</h1>
            <LeadStageBadge stage={lead.stage} />
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{lead.market}</span>
            {lead.doNotContact && (
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
                Do not contact
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-slate-600">
            {lead.contactPerson}
            {lead.companyName ? ` · ${lead.companyName}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-600">
            Stage
            <select
              value={lead.stage}
              disabled={isBusy || !canEdit}
              onChange={(event) => save({ stage: event.target.value, stageReason: 'Changed on the enquiry page' })}
              className="ml-2 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
            >
              {LEAD_STAGES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <Button
            variant={lead.doNotContact ? 'secondary' : 'ghost'}
            size="sm"
            disabled={isBusy || !canEdit}
            onClick={() => save({ doNotContact: !lead.doNotContact })}
          >
            {lead.doNotContact ? 'Allow contact' : 'Do not contact'}
          </Button>
        </div>
      </div>

      {actionError && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {actionError?.response?.data?.message ?? actionError?.message ?? 'That change could not be saved.'}
        </p>
      )}

      {!lead.campaignEligible && !lead.doNotContact && (
        <p className="rounded-lg bg-slate-50 px-4 py-2.5 text-sm text-slate-600 ring-1 ring-inset ring-slate-200">
          Campaigns will not include this enquiry while it is at the{' '}
          <span className="font-medium">{lead.stageLabel}</span> stage.
        </p>
      )}

      {/*
        Keyed on the enquiry so a fresh draft is built each time it opens —
        without the key, React would keep the previous record's values in the
        dialog's own state after a background refresh.
      */}
      {isEditOpen && (
        <LeadEditDialog
          key={lead.updatedAt ?? lead.id}
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          lead={lead}
          contact={contact}
          company={company}
          isSaving={action === 'save'}
          error={actionError}
          onSave={saveFull}
        />
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* --- Enquiry ---------------------------------------------------- */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-900">Enquiry</h2>

            {/*
              Rendered from the server's `canEdit`, not from a client-side
              comparison, so the control and the endpoint's guard cannot
              disagree. An imported enquiry is an ordinary enquiry here: nothing
              on this page reads `sourceSheet` to decide anything.
            */}
            {canEdit && (
              <Button variant="secondary" size="sm" onClick={() => setIsEditOpen(true)}>
                <Pencil className="size-3.5" aria-hidden="true" />
                Edit lead
              </Button>
            )}
          </div>

          <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {[
              ['Query Date', formatDate(lead.quoteDate)],
              [
                'Travel date',
                // Prose values are shown verbatim; the sheet says "August" for
                // 24 enquiries and inventing a date would be a fabrication.
                lead.travelDate ? formatDate(lead.travelDate) : (lead.travelDateText ?? '—'),
              ],
              ['Departure city', lead.city ?? '—'],
              ['Party', lead.paxText ?? '—'],
              [
                'Adults / children',
                lead.adultCount === null && lead.childCount === null
                  ? 'Not parsed'
                  : `${lead.adultCount ?? '?'} / ${lead.childCount ?? 0}`,
              ],
              ['Handled by', lead.handledBy ?? '—'],
              ['Days open', lead.ageInDays === null ? '—' : `${lead.ageInDays}`],
              ['Source sheet', lead.sourceSheet ? `${lead.sourceSheet} row ${lead.sourceRow}` : '—'],
              // Record metadata. Travel date is the enquiry's operative date and
              // leads the listings; when the record entered the CRM is still
              // worth knowing, so it lives here rather than in a column.
              ['Created', formatDate(lead.createdAt)],
              ['Updated', formatDate(lead.updatedAt)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
                <dd className="mt-0.5 text-sm text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5">
            <label htmlFor="lead-notes" className="block text-xs font-medium uppercase tracking-wide text-slate-500">
              Internal notes
            </label>
            <textarea
              id="lead-notes"
              rows={4}
              value={noteValue}
              onChange={(event) => setNotes(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <div className="mt-2 flex items-center gap-2">
              <Button
                size="sm"
                disabled={isBusy || !canEdit || noteValue === (lead.internalNotes ?? '')}
                isLoading={action === 'save'}
                onClick={async () => {
                  await save({ internalNotes: noteValue })
                  setNotes(null)
                }}
              >
                Save notes
              </Button>
              <span className="text-xs text-slate-400">Never sent to the customer.</span>
            </div>
          </div>
        </section>

        {/* --- People ----------------------------------------------------- */}
        <div className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <User className="size-4 text-slate-400" aria-hidden="true" />
              Contact
            </h2>
            {contact ? (
              <div className="mt-3 space-y-1.5 text-sm">
                <p className="font-medium text-slate-900">{contact.displayName ?? lead.contactPerson}</p>
                <p className="flex items-center gap-1.5 text-slate-600">
                  <Mail className="size-3.5 text-slate-400" aria-hidden="true" />
                  <a href={`mailto:${contact.primaryEmail}`} className="hover:text-blue-600">{contact.primaryEmail}</a>
                </p>
                {(contact.phones ?? []).map((phone) => (
                  <p key={phone} className="flex items-center gap-1.5 text-slate-600">
                    <Phone className="size-3.5 text-slate-400" aria-hidden="true" />
                    {phone}
                  </p>
                ))}
                <p className="pt-1 text-xs text-slate-400">
                  {contact.leadCount ?? 0} enquiry/enquiries from this person
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-400">No contact record linked.</p>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <Building2 className="size-4 text-slate-400" aria-hidden="true" />
              Company
            </h2>
            {company ? (
              <div className="mt-3 space-y-1.5 text-sm">
                <Link
                  to={ROUTE_PATHS.COMPANY_DETAIL.replace(':id', company.id)}
                  className="font-medium text-blue-600 hover:underline"
                >
                  {company.companyName}
                </Link>
                {company.emailDomain && <p className="text-xs text-slate-500">{company.emailDomain}</p>}
                <p className="text-xs text-slate-400">
                  {company.contactCount} contact(s) · {company.leadCount} enquiry/enquiries
                </p>
                {company.city && <p className="text-xs text-slate-500">{company.city}</p>}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-400">No company record linked.</p>
            )}
          </section>
        </div>
      </div>

      {/* --- Correspondence -------------------------------------------------
          Our introduction, the customer's reply, and everything after. Kept
          above the stage history because it is what a salesperson opens this
          page to read; the stage history is reference. */}
      <LeadConversation
        lead={lead}
        messages={correspondence?.messages ?? []}
        attachments={correspondence?.attachments ?? []}
        isLoading={isConversationLoading}
      />

      {/* --- History ------------------------------------------------------- */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Stage history</h2>
        <ol className="mt-3 space-y-2">
          {(lead.stageHistory ?? []).map((entry, index) => (
            <li key={index} className="flex flex-wrap items-baseline gap-x-3 text-sm">
              <span className="font-mono text-xs text-slate-400">{formatDateTime(entry.at)}</span>
              <span className="text-slate-700">
                {entry.from ? `${entry.from} → ${entry.to}` : `Created as ${entry.to}`}
              </span>
              {entry.reason && <span className="text-xs text-slate-400">{entry.reason}</span>}
            </li>
          ))}
          {(lead.stageHistory ?? []).length === 0 && (
            <li className="text-sm text-slate-400">No transitions recorded.</li>
          )}
        </ol>
      </section>
    </div>
  )
}

export default LeadDetailPage
