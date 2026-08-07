/**
 * Six-step campaign builder.
 *
 * ## Why the campaign is created at step 2, not at the end
 *
 * Preview and audience resolution both need a persisted campaign — the server
 * resolves an audience against stored criteria and renders a preview from
 * stored content. Deferring creation to the final step would mean either
 * duplicating that logic client-side (which would then disagree with the
 * server) or offering no preview at all.
 *
 * A campaign created here is a **draft**. Drafts send nothing: launch is a
 * separate, explicit action on the last step. Abandoning the wizard leaves a
 * draft behind, which is recoverable, rather than losing the user's work.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Rocket } from 'lucide-react'

import { fetchContacts } from '@/api/services/contact.service'
import {
  createCampaign,
  fetchSendingMailboxes,
  fetchTemplates,
  launchCampaign,
  previewCampaign,
  updateCampaign,
} from '@/api/services/campaign.service'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import {
  BUILDER_STEPS,
  DEFAULT_THROTTLE,
  MAX_RATE_LIMITS,
  PERSONALISATION_VARIABLES,
} from '@/constants/campaign.constants'
import { ROUTE_PATHS } from '@/routes/paths'
import { isCancelledError } from '@/utils/apiError'

const AUDIENCE_PAGE = 200

export function CampaignBuilderPage() {
  const navigate = useNavigate()

  const [stepIndex, setStepIndex] = useState(0)
  const [campaignId, setCampaignId] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)

  // --- Form state ---------------------------------------------------------
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedContacts, setSelectedContacts] = useState(() => new Set())
  const [templateId, setTemplateId] = useState('')
  const [subject, setSubject] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [mailboxIds, setMailboxIds] = useState([])
  const [throttle, setThrottle] = useState({ ...DEFAULT_THROTTLE })
  const [campaignValues, setCampaignValues] = useState({ Destination: '', Agent: '' })
  const [scheduledFor, setScheduledFor] = useState('')

  // --- Reference data -----------------------------------------------------
  const [contacts, setContacts] = useState([])
  const [templates, setTemplates] = useState([])
  const [mailboxes, setMailboxes] = useState([])
  const [preview, setPreview] = useState(null)
  const [isLoadingRefs, setIsLoadingRefs] = useState(true)

  useEffect(() => {
    const controller = new AbortController()

    async function load() {
      try {
        const [contactPage, templateList, mailboxList] = await Promise.all([
          fetchContacts({ limit: AUDIENCE_PAGE, sort: '-created' }, { signal: controller.signal }),
          fetchTemplates({}, { signal: controller.signal }),
          fetchSendingMailboxes({ signal: controller.signal }).catch(() => []),
        ])
        if (controller.signal.aborted) return

        setContacts(contactPage.items)
        setTemplates(templateList)
        setMailboxes(mailboxList)
        /**
         * Pre-select a sensible sender so the step has a valid answer already.
         *
         * One mailbox is no decision at all. With several, the workspace
         * default is the address this business normally sends from, so it is
         * the right starting point — and the operator can still tick more to
         * spread a large send across the rotation.
         */
        if (mailboxList.length === 1) {
          setMailboxIds([mailboxList[0].id])
        } else {
          const preferred = mailboxList.find((mailbox) => mailbox.isDefault)
          if (preferred) setMailboxIds([preferred.id])
        }
        setError(null)
      } catch (loadError) {
        // An aborted batch is not a failure. `httpClient` rejects with a plain
        // normalised object that has no `name`, so the old
        // `loadError.name !== 'CanceledError'` test was always true and the
        // superseded request rendered as "Request was cancelled." on open.
        if (isCancelledError(loadError) || controller.signal.aborted) return
        setError(loadError)
      } finally {
        // Skipped for an aborted pass: either the component is gone, or a newer
        // pass owns the loading state and is about to resolve it itself.
        if (!controller.signal.aborted) setIsLoadingRefs(false)
      }
    }

    load()
    return () => controller.abort()
  }, [])

  const step = BUILDER_STEPS[stepIndex]

  /** Applying a template overwrites the message; it is the point of choosing one. */
  const applyTemplate = useCallback(
    (id) => {
      setTemplateId(id)
      const template = templates.find((item) => item.id === id)
      if (template) {
        setSubject(template.subject)
        setBodyHtml(template.bodyHtml)
      }
    },
    [templates],
  )

  const toggleContact = useCallback((id) => {
    setSelectedContacts((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  /** What blocks the current step. Empty means the user may continue. */
  const blockers = useMemo(() => {
    const problems = []
    if (step.id === 'details' && name.trim().length === 0) problems.push('Give the campaign a name.')
    if (step.id === 'audience' && selectedContacts.size === 0) problems.push('Select at least one contact.')
    if (step.id === 'message') {
      if (subject.trim().length === 0) problems.push('A subject is required.')
      if (bodyHtml.trim().length === 0) problems.push('The message body is empty.')
    }
    if (step.id === 'sending' && mailboxIds.length === 0) problems.push('Choose at least one sending mailbox.')
    return problems
  }, [step.id, name, selectedContacts, subject, bodyHtml, mailboxIds])

  const payload = useMemo(
    () => ({
      name: name.trim(),
      description: description.trim() || null,
      template: templateId || null,
      subject,
      bodyHtml,
      senderMailboxes: mailboxIds,
      audience: { source: 'manual', contactIds: [...selectedContacts] },
      throttle,
      // Empty strings are dropped: an unset Destination must fall back to the
      // variable's own default rather than rendering as a blank gap.
      variables: Object.fromEntries(
        Object.entries(campaignValues).filter(([, value]) => value.trim().length > 0),
      ),
    }),
    [name, description, templateId, subject, bodyHtml, mailboxIds, selectedContacts, throttle, campaignValues],
  )

  /** Creates the draft on first save, updates it thereafter. */
  const persist = useCallback(async () => {
    setIsSaving(true)
    setError(null)
    try {
      if (campaignId) {
        await updateCampaign(campaignId, payload)
        return campaignId
      }
      const created = await createCampaign(payload)
      setCampaignId(created.id)
      return created.id
    } catch (saveError) {
      setError(saveError)
      return null
    } finally {
      setIsSaving(false)
    }
  }, [campaignId, payload])

  const goNext = useCallback(async () => {
    if (blockers.length > 0) return

    // The draft exists from the audience step onward, because preview and
    // audience resolution are both server-side.
    if (stepIndex >= 1) {
      const id = await persist()
      if (!id) return

      if (BUILDER_STEPS[stepIndex + 1]?.id === 'preview') {
        try {
          setPreview(await previewCampaign(id, { limit: 3 }))
        } catch (previewError) {
          setError(previewError)
          return
        }
      }
    }

    setStepIndex((index) => Math.min(BUILDER_STEPS.length - 1, index + 1))
  }, [blockers, stepIndex, persist])

  const handleLaunch = useCallback(async () => {
    const id = await persist()
    if (!id) return

    setIsSaving(true)
    try {
      await launchCampaign(id, { scheduledFor: scheduledFor || null })
      navigate(ROUTE_PATHS.CAMPAIGN_DETAIL.replace(':id', id))
    } catch (launchError) {
      setError(launchError)
    } finally {
      setIsSaving(false)
    }
  }, [persist, scheduledFor, navigate])

  if (isLoadingRefs) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading contacts and templates" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* --- Stepper ------------------------------------------------------ */}
      <ol className="flex flex-wrap gap-2" aria-label="Campaign builder progress">
        {BUILDER_STEPS.map((item, index) => {
          const state = index === stepIndex ? 'current' : index < stepIndex ? 'done' : 'todo'
          return (
            <li key={item.id} className="flex items-center gap-2">
              <span
                aria-current={state === 'current' ? 'step' : undefined}
                className={[
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset',
                  state === 'current' && 'bg-brand-600 text-white ring-brand-600',
                  state === 'done' && 'bg-emerald-50 text-emerald-700 ring-emerald-200',
                  state === 'todo' && 'bg-white text-slate-500 ring-slate-200',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {state === 'done' && <Check className="size-3" aria-hidden="true" />}
                {index + 1}. {item.label}
              </span>
            </li>
          )
        })}
      </ol>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error?.response?.data?.message ?? error?.message ?? 'Something went wrong.'}
        </p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        {/* --- 1. Details ------------------------------------------------- */}
        {step.id === 'details' && (
          <div className="max-w-xl space-y-4">
            <div>
              <label htmlFor="campaign-name" className="block text-sm font-medium text-slate-700">
                Campaign name
              </label>
              <input
                id="campaign-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Summer Escapes — Corporate"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <p className="mt-1 text-xs text-slate-400">Internal only — recipients never see this.</p>
            </div>

            <div>
              <label htmlFor="campaign-description" className="block text-sm font-medium text-slate-700">
                Description
              </label>
              <textarea
                id="campaign-description"
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        )}

        {/* --- 2. Audience ------------------------------------------------ */}
        {step.id === 'audience' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-600">
                {selectedContacts.size.toLocaleString()} of {contacts.length.toLocaleString()} selected
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setSelectedContacts(new Set(contacts.map((c) => c.id)))}>
                  Select all
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedContacts(new Set())}>
                  Clear
                </Button>
              </div>
            </div>

            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
              {contacts.map((contact) => (
                <li key={contact.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                    <input
                      type="checkbox"
                      checked={selectedContacts.has(contact.id)}
                      onChange={() => toggleContact(contact.id)}
                      className="size-4 rounded border-slate-300"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-slate-900">{contact.displayName}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {contact.primaryEmail ?? 'No email address'}
                        {contact.company ? ` — ${contact.company}` : ''}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>

            {contacts.length === AUDIENCE_PAGE && (
              <p className="text-xs text-slate-400">
                Showing the {AUDIENCE_PAGE} most recent contacts. Larger audiences are better built
                from a group or an import, which the campaign resolves server-side.
              </p>
            )}
          </div>
        )}

        {/* --- 3. Message -------------------------------------------------- */}
        {step.id === 'message' && (
          <div className="space-y-4">
            <div className="max-w-xl">
              <label htmlFor="campaign-template" className="block text-sm font-medium text-slate-700">
                Start from a template
              </label>
              <select
                id="campaign-template"
                value={templateId}
                onChange={(event) => applyTemplate(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Write from scratch</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="campaign-subject" className="block text-sm font-medium text-slate-700">
                Subject
              </label>
              <input
                id="campaign-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label htmlFor="campaign-body" className="block text-sm font-medium text-slate-700">
                Message
              </label>
              <textarea
                id="campaign-body"
                rows={12}
                value={bodyHtml}
                onChange={(event) => setBodyHtml(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-700">Personalisation</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PERSONALISATION_VARIABLES.map((variable) => (
                  <button
                    key={variable.name}
                    type="button"
                    title={variable.hint}
                    onClick={() => setBodyHtml((current) => `${current}{{${variable.name}}}`)}
                    className="rounded border border-slate-200 bg-white px-2 py-1 font-mono text-xs text-slate-600 hover:border-blue-400 hover:text-blue-600"
                  >
                    {`{{${variable.name}}}`}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Every variable has a fallback, so a contact with no company never receives a blank gap.
              </p>
            </div>

            <div className="grid max-w-xl gap-4 sm:grid-cols-2">
              {['Destination', 'Agent'].map((key) => (
                <div key={key}>
                  <label htmlFor={`value-${key}`} className="block text-sm font-medium text-slate-700">
                    {`{{${key}}}`}
                  </label>
                  <input
                    id={`value-${key}`}
                    value={campaignValues[key]}
                    onChange={(event) => setCampaignValues((current) => ({ ...current, [key]: event.target.value }))}
                    placeholder={key === 'Destination' ? 'Dubai' : 'Priya Raman'}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- 4. Sending -------------------------------------------------- */}
        {step.id === 'sending' && (
          <div className="space-y-6">
            <fieldset>
              <legend className="text-sm font-medium text-slate-700">Sending mailboxes</legend>
              <p className="mt-1 text-xs text-slate-500">
                Messages rotate across these. Spreading the load is what keeps a large send below
                the provider&rsquo;s per-mailbox ceiling.
              </p>

              {mailboxes.length === 0 ? (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
                  No mailbox is connected. Connect one from{' '}
                  <Link
                    to={ROUTE_PATHS.ACCOUNT}
                    className="font-medium underline underline-offset-2 hover:text-amber-950"
                  >
                    Account
                  </Link>{' '}
                  before launching.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  {mailboxes.map((mailbox) => (
                    <label key={mailbox.id} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={mailboxIds.includes(mailbox.id)}
                        onChange={(event) =>
                          setMailboxIds((current) =>
                            event.target.checked ? [...current, mailbox.id] : current.filter((id) => id !== mailbox.id),
                          )
                        }
                        className="size-4 rounded border-slate-300"
                      />
                      <span className="text-sm text-slate-900">{mailbox.emailAddress ?? mailbox.displayName}</span>
                      <span className="ml-auto text-xs text-slate-400">{mailbox.status}</span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>

            <fieldset>
              <legend className="text-sm font-medium text-slate-700">Rate limits</legend>
              <p className="mt-1 text-xs text-slate-500">
                Counted across all your campaigns, because the limit protects the mailbox rather
                than any one send.
              </p>

              <div className="mt-3 grid max-w-2xl gap-4 sm:grid-cols-4">
                {[
                  { key: 'perMinute', label: 'Per minute', max: MAX_RATE_LIMITS.perMinute },
                  { key: 'perHour', label: 'Per hour', max: MAX_RATE_LIMITS.perHour },
                  { key: 'perDay', label: 'Per day', max: MAX_RATE_LIMITS.perDay },
                  { key: 'batchSize', label: 'Batch size', max: 100 },
                ].map((field) => (
                  <div key={field.key}>
                    <label htmlFor={`throttle-${field.key}`} className="block text-xs font-medium text-slate-600">
                      {field.label}
                    </label>
                    <input
                      id={`throttle-${field.key}`}
                      type="number"
                      min={1}
                      max={field.max}
                      value={throttle[field.key]}
                      onChange={(event) =>
                        setThrottle((current) => ({ ...current, [field.key]: Number(event.target.value) || 1 }))
                      }
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tabular-nums outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                    {throttle[field.key] > field.max && (
                      <p className="mt-1 text-xs text-amber-600">Capped at {field.max.toLocaleString()} on save.</p>
                    )}
                  </div>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {/* --- 5. Preview -------------------------------------------------- */}
        {step.id === 'preview' && (
          <div className="space-y-4">
            {preview?.campaignRequired?.length > 0 && (
              <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-200">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  These variables have no value and will block launch:{' '}
                  <span className="font-mono">{preview.campaignRequired.join(', ')}</span>
                </span>
              </p>
            )}

            <p className="text-sm text-slate-600">
              Rendered for {preview?.previews?.length ?? 0} real recipients, exactly as they will
              receive it.
            </p>

            <div className="space-y-4">
              {(preview?.previews ?? []).map((sample, index) => (
                <article key={index} className="rounded-lg border border-slate-200">
                  <header className="border-b border-slate-100 bg-slate-50 px-4 py-2">
                    <p className="text-xs text-slate-500">
                      To: {sample.contactName ? `${sample.contactName} <${sample.email}>` : sample.email}
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-slate-900">{sample.subject}</p>
                  </header>
                  {/* Server-rendered from stored content and HTML-escaped contact
                      data — the same string the provider is handed. */}
                  <div
                    className="prose prose-sm max-w-none px-4 py-3"
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{ __html: sample.html }}
                  />
                </article>
              ))}
            </div>
          </div>
        )}

        {/* --- 6. Launch --------------------------------------------------- */}
        {step.id === 'launch' && (
          <div className="max-w-xl space-y-4">
            <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {[
                ['Campaign', name],
                ['Recipients', selectedContacts.size.toLocaleString()],
                ['Subject', subject],
                ['Mailboxes', `${mailboxIds.length} in rotation`],
                ['Rate', `${throttle.perMinute}/min, ${throttle.perHour}/hr, ${throttle.perDay}/day`],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-4 px-4 py-2.5">
                  <dt className="w-32 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
                  <dd className="min-w-0 flex-1 truncate text-sm text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>

            <div>
              <label htmlFor="campaign-schedule" className="block text-sm font-medium text-slate-700">
                Schedule for later (optional)
              </label>
              <input
                id="campaign-schedule"
                type="datetime-local"
                value={scheduledFor}
                onChange={(event) => setScheduledFor(event.target.value)}
                className="mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <p className="mt-1 text-xs text-slate-400">Leave empty to start sending immediately.</p>
            </div>

            <Button onClick={handleLaunch} isLoading={isSaving} loadingLabel="Launching…" size="lg">
              <Rocket className="size-4" aria-hidden="true" />
              {scheduledFor ? 'Schedule campaign' : 'Launch campaign'}
            </Button>
          </div>
        )}
      </div>

      {/* --- Navigation ---------------------------------------------------- */}
      <div className="flex items-center justify-between">
        <Button
          variant="secondary"
          disabled={stepIndex === 0 || isSaving}
          onClick={() => setStepIndex((index) => Math.max(0, index - 1))}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back
        </Button>

        <div className="flex items-center gap-3">
          {blockers.length > 0 && <p className="text-xs text-amber-600">{blockers[0]}</p>}
          {stepIndex < BUILDER_STEPS.length - 1 && (
            <Button onClick={goNext} disabled={blockers.length > 0} isLoading={isSaving}>
              Continue
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default CampaignBuilderPage
