/**
 * The template editor.
 *
 * Two panes: what you are writing on the left, what the recipient will receive
 * on the right. The right-hand side is rendered by the server through the same
 * function the morning run uses, against a real enquiry from the register — so
 * the preview cannot promise something a send would not produce, which is the
 * only thing that makes a preview worth having.
 *
 * ## Why the body has two modes
 *
 * A marketing HTML email is a table layout with inline styles, and a
 * contenteditable rich-text surface rewrites that the moment anyone types in
 * it. So HTML source is the default and the honest one; rich text is offered
 * for writing simple prose, and switching to it is a deliberate choice.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Code2, Eye, Power, Save, Send, Type } from 'lucide-react'

import {
  activateTemplate,
  createTemplate,
  fetchTemplate,
  previewTemplate,
  sendTestEmail,
  updateTemplate,
} from '@/api/services/template.service'
import { fetchLeads } from '@/api/services/lead.service'
import { RichTextEditor } from '@/components/mail/RichTextEditor'
import { TemplatePreview } from '@/components/templates/TemplatePreview'
import { VariablePicker } from '@/components/templates/VariablePicker'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import {
  SUBJECT_TRUNCATION_HINT,
  TEMPLATE_CATEGORIES,
  TEMPLATE_STATUS,
} from '@/constants/template.constants'
import { isCancelledError } from '@/utils/apiError'
import { useTemplateVariables } from '@/hooks/useTemplates'
import { ROUTE_PATHS } from '@/routes/paths'

const EMPTY = {
  name: '',
  description: '',
  category: 'travel_offer',
  subject: '',
  bodyHtml: '',
  bodyText: '',
}

const messageOf = (error, fallback) =>
  error?.response?.data?.message ?? error?.message ?? fallback

export function TemplateEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id

  const [draft, setDraft] = useState(EMPTY)
  const [loaded, setLoaded] = useState(null)
  const [isLoading, setIsLoading] = useState(!isNew)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const [bodyMode, setBodyMode] = useState('html')
  const [previewMode, setPreviewMode] = useState('html')
  const [device, setDevice] = useState('desktop')

  const [leads, setLeads] = useState([])
  const [leadId, setLeadId] = useState('')
  const [preview, setPreview] = useState(null)
  const [isPreviewing, setIsPreviewing] = useState(false)

  const [testAddress, setTestAddress] = useState('')
  const [isTesting, setIsTesting] = useState(false)

  const { variables } = useTemplateVariables()
  const bodyRef = useRef(null)

  const setField = useCallback((field, value) => {
    setDraft((current) => ({ ...current, [field]: value }))
  }, [])

  // --- Load ------------------------------------------------------------------
  useEffect(() => {
    if (isNew) return undefined

    const controller = new AbortController()

    ;(async () => {
      try {
        const template = await fetchTemplate(id, { signal: controller.signal })
        if (!template) return
        setLoaded(template)
        setDraft({
          name: template.name,
          description: template.description ?? '',
          category: template.category,
          subject: template.subject,
          bodyHtml: template.bodyHtml,
          bodyText: template.bodyText ?? '',
        })
      } catch (loadError) {
        // Same defect the campaign wizard had: the normalised rejection carries
        // no `name`, so an aborted load was reported as a real error.
        if (isCancelledError(loadError) || controller.signal.aborted) return
        setError(loadError)
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    })()

    return () => controller.abort()
  }, [id, isNew])

  // A handful of recent enquiries to preview against. Not the whole register —
  // the point is a realistic example, not a browser.
  useEffect(() => {
    const controller = new AbortController()

    fetchLeads({ page: 1, limit: 25 }, { signal: controller.signal })
      .then((result) => setLeads(result.items ?? []))
      .catch(() => setLeads([]))

    return () => controller.abort()
  }, [])

  // --- Live preview ----------------------------------------------------------
  //
  // Debounced, because it is a network round trip per keystroke otherwise.
  useEffect(() => {
    if (!draft.subject.trim() || !draft.bodyHtml.trim()) {
      setPreview(null)
      return undefined
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setIsPreviewing(true)
      try {
        setPreview(
          await previewTemplate(
            {
              ...(id ? { templateId: id } : {}),
              ...(leadId ? { leadId } : {}),
              subject: draft.subject,
              bodyHtml: draft.bodyHtml,
              ...(draft.bodyText.trim() ? { bodyText: draft.bodyText } : {}),
            },
            { signal: controller.signal },
          ),
        )
      } catch (previewError) {
        // A superseded keystroke must not blank the preview the newer request
        // is about to replace, nor clear the spinner it owns.
        if (isCancelledError(previewError) || controller.signal.aborted) return
        setPreview(null)
      } finally {
        if (!controller.signal.aborted) setIsPreviewing(false)
      }
    }, 400)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [draft.subject, draft.bodyHtml, draft.bodyText, leadId, id])

  /**
   * Inserts a variable at the caret.
   *
   * Appending to the end would be simpler and useless — a variable belongs
   * where the writer's cursor is, mid-sentence.
   */
  const insertVariable = useCallback(
    (token) => {
      if (bodyMode !== 'html') {
        setField('bodyHtml', `${draft.bodyHtml}${token}`)
        return
      }

      const field = bodyRef.current
      if (!field) {
        setField('bodyHtml', `${draft.bodyHtml}${token}`)
        return
      }

      const start = field.selectionStart ?? draft.bodyHtml.length
      const end = field.selectionEnd ?? start
      const next = `${draft.bodyHtml.slice(0, start)}${token}${draft.bodyHtml.slice(end)}`

      setField('bodyHtml', next)

      // Restored after React re-renders, or the caret jumps to the end and the
      // next insert lands in the wrong place.
      requestAnimationFrame(() => {
        field.focus()
        field.setSelectionRange(start + token.length, start + token.length)
      })
    },
    [bodyMode, draft.bodyHtml, setField],
  )

  const isValid = draft.name.trim() && draft.subject.trim() && draft.bodyHtml.trim()

  const handleSave = useCallback(
    async ({ thenActivate = false } = {}) => {
      setIsSaving(true)
      setError(null)
      setNotice(null)

      try {
        const payload = {
          name: draft.name.trim(),
          description: draft.description.trim() || null,
          category: draft.category,
          subject: draft.subject.trim(),
          bodyHtml: draft.bodyHtml,
          bodyText: draft.bodyText,
        }

        if (isNew) {
          const created = await createTemplate({ ...payload, status: TEMPLATE_STATUS.DRAFT })
          if (thenActivate) await activateTemplate(created.id)
          navigate(ROUTE_PATHS.TEMPLATES)
          return
        }

        const { template, message } = await updateTemplate(id, payload)
        setLoaded(template)

        if (thenActivate) {
          const result = await activateTemplate(id)
          setLoaded(result.template)
          setNotice(result.message)
        } else {
          setNotice(message)
        }
      } catch (saveError) {
        setError(saveError)
      } finally {
        setIsSaving(false)
      }
    },
    [draft, id, isNew, navigate],
  )

  const handleTest = useCallback(async () => {
    setIsTesting(true)
    setError(null)
    setNotice(null)

    try {
      const result = await sendTestEmail({
        to: testAddress.trim(),
        ...(id ? { templateId: id } : {}),
        subject: draft.subject,
        bodyHtml: draft.bodyHtml,
        ...(draft.bodyText.trim() ? { bodyText: draft.bodyText } : {}),
      })
      setNotice(result.message)
    } catch (testError) {
      setError(testError)
    } finally {
      setIsTesting(false)
    }
  }, [testAddress, id, draft])

  const subjectLength = draft.subject.length
  const bodyLength = draft.bodyHtml.length

  const unresolved = preview?.unresolved ?? []

  const leadOptions = useMemo(
    () =>
      leads.map((lead) => ({
        id: lead.id,
        label: `${lead.reference} — ${lead.contactPerson ?? lead.companyName ?? 'unnamed'}`,
      })),
    [leads],
  )

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner label="Loading template" />
      </div>
    )
  }

  const isArchived = loaded?.status === TEMPLATE_STATUS.ARCHIVED

  return (
    <div className="space-y-4">
      {/* --- Header ---------------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-3">
        <Button as={Link} to={ROUTE_PATHS.TEMPLATES} variant="ghost" size="sm">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Templates
        </Button>

        <h1 className="text-base font-semibold text-slate-900">
          {isNew ? 'New template' : draft.name || 'Template'}
        </h1>

        {loaded && (
          <span className="text-xs text-slate-400">
            version {loaded.version}
            {loaded.status === TEMPLATE_STATUS.ACTIVE && ' · active'}
          </span>
        )}

        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => handleSave()}
            isLoading={isSaving}
            disabled={!isValid || isArchived}
          >
            <Save className="size-4" aria-hidden="true" />
            Save
          </Button>

          {loaded?.status !== TEMPLATE_STATUS.ACTIVE && (
            <Button
              onClick={() => handleSave({ thenActivate: true })}
              isLoading={isSaving}
              disabled={!isValid || isArchived}
            >
              <Power className="size-4" aria-hidden="true" />
              Save &amp; activate
            </Button>
          )}
        </div>
      </div>

      {isArchived && (
        <p className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm text-slate-600 ring-1 ring-inset ring-slate-200">
          This template is archived and read-only. Duplicate it from the library to work from it.
        </p>
      )}

      {loaded?.status === TEMPLATE_STATUS.ACTIVE && (
        <p className="rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900 ring-1 ring-inset ring-emerald-200">
          This is the active template. Saving changes what new enquiries receive from the next send
          onward; messages already sent keep the wording they were sent with.
        </p>
      )}

      {notice && (
        <p role="status" className="rounded-lg bg-blue-50 px-4 py-2.5 text-sm text-blue-900 ring-1 ring-inset ring-blue-200">
          {notice}
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
          {messageOf(error, 'That could not be saved.')}
        </p>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        {/* --- Editor -------------------------------------------------------- */}
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="tpl-name" className="block text-sm font-medium text-slate-700">
                Name
              </label>
              <input
                id="tpl-name"
                value={draft.name}
                onChange={(event) => setField('name', event.target.value)}
                disabled={isArchived}
                placeholder="B2B Introduction"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
              />
            </div>

            <div>
              <label htmlFor="tpl-category" className="block text-sm font-medium text-slate-700">
                Category
              </label>
              <select
                id="tpl-category"
                value={draft.category}
                onChange={(event) => setField('category', event.target.value)}
                disabled={isArchived}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
              >
                {TEMPLATE_CATEGORIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="tpl-description" className="block text-sm font-medium text-slate-700">
              Description <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              id="tpl-description"
              value={draft.description}
              onChange={(event) => setField('description', event.target.value)}
              disabled={isArchived}
              placeholder="When this template should be used."
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
            />
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <label htmlFor="tpl-subject" className="block text-sm font-medium text-slate-700">
                Subject
              </label>
              <span
                className={`text-xs tabular-nums ${
                  subjectLength > SUBJECT_TRUNCATION_HINT ? 'text-amber-600' : 'text-slate-400'
                }`}
              >
                {subjectLength} characters
                {subjectLength > SUBJECT_TRUNCATION_HINT && ' — most clients truncate here'}
              </span>
            </div>
            <input
              id="tpl-subject"
              value={draft.subject}
              onChange={(event) => setField('subject', event.target.value)}
              disabled={isArchived}
              placeholder="Partner with us | {{Destination}}"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
            />
          </div>

          <VariablePicker variables={variables} onInsert={insertVariable} isDisabled={isArchived} />

          <div>
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="tpl-body" className="block text-sm font-medium text-slate-700">
                Message body
              </label>

              <div className="flex items-center gap-3">
                <span className="text-xs tabular-nums text-slate-400">
                  {bodyLength.toLocaleString()} characters
                </span>
                <div className="flex rounded-lg border border-slate-200 p-0.5" role="group" aria-label="Editing mode">
                  {[
                    { id: 'html', Icon: Code2, label: 'HTML' },
                    { id: 'rich', Icon: Type, label: 'Rich text' },
                  ].map(({ id: mode, Icon, label }) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setBodyMode(mode)}
                      aria-pressed={bodyMode === mode}
                      className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                        bodyMode === mode ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
                      }`}
                    >
                      <Icon className="size-3.5" aria-hidden="true" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {bodyMode === 'html' ? (
              <textarea
                id="tpl-body"
                ref={bodyRef}
                rows={16}
                value={draft.bodyHtml}
                onChange={(event) => setField('bodyHtml', event.target.value)}
                disabled={isArchived}
                spellCheck={false}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs leading-relaxed outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
              />
            ) : (
              <div className="mt-1">
                <RichTextEditor
                  value={draft.bodyHtml}
                  onChange={(html) => setField('bodyHtml', html)}
                  disabled={isArchived}
                  placeholder="Write the message…"
                />
                <p className="mt-1 text-xs text-amber-600">
                  Rich text rewrites the markup as you type. For a table-based HTML email, edit the
                  HTML directly.
                </p>
              </div>
            )}
          </div>

          <details className="rounded-lg border border-slate-200 p-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-700">
              Plain-text version <span className="font-normal text-slate-400">(optional)</span>
            </summary>
            <p className="mt-2 text-xs text-slate-500">
              Derived from the HTML when left empty. Sending HTML with no text part raises a
              message&rsquo;s spam score, so there is always one either way.
            </p>
            <textarea
              rows={10}
              value={draft.bodyText}
              onChange={(event) => setField('bodyText', event.target.value)}
              disabled={isArchived}
              aria-label="Plain-text version"
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50"
            />
          </details>

          {/* --- Test send ---------------------------------------------------- */}
          <div className="rounded-lg border border-slate-200 p-3">
            <h3 className="text-sm font-medium text-slate-700">Send a test</h3>
            <p className="mt-1 text-xs text-slate-500">
              Rendered with sample enquiry data and sent to the address below. Nothing is written to
              mail history and no enquiry is touched.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                type="email"
                value={testAddress}
                onChange={(event) => setTestAddress(event.target.value)}
                placeholder="you@yourcompany.com"
                aria-label="Test recipient"
                className="min-w-48 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <Button
                variant="secondary"
                onClick={handleTest}
                isLoading={isTesting}
                disabled={!testAddress.trim() || !isValid}
              >
                <Send className="size-4" aria-hidden="true" />
                Send test
              </Button>
            </div>
          </div>
        </div>

        {/* --- Preview ------------------------------------------------------- */}
        {/* The ceiling subtracts the top bar as well as the sticky offset: the
            scroll container is the shell's `<main>`, whose visible height is a
            viewport minus the chrome above it, not a whole `100vh`. Measuring
            against `100vh` ran the panel past the fold by the bar's height. */}
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white xl:sticky xl:top-4 xl:max-h-[calc(100svh-var(--spacing-topbar)-2rem)]">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2.5">
            <Eye className="size-4 text-slate-400" aria-hidden="true" />
            <h2 className="text-sm font-medium text-slate-700">Preview</h2>

            <select
              value={leadId}
              onChange={(event) => setLeadId(event.target.value)}
              aria-label="Preview against enquiry"
              className="ml-auto max-w-48 rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:border-blue-500"
            >
              <option value="">Most recent enquiry</option>
              {leadOptions.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {lead.label}
                </option>
              ))}
            </select>

            <div className="flex rounded-lg border border-slate-200 p-0.5" role="group" aria-label="Preview format">
              {[
                { id: 'html', label: 'HTML' },
                { id: 'text', label: 'Text' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPreviewMode(item.id)}
                  aria-pressed={previewMode === item.id}
                  className={`rounded-md px-2 py-1 text-xs transition-colors ${
                    previewMode === item.id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {preview?.isSample && (
            <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
              Rendered with sample data — the register has no enquiries yet.
            </p>
          )}

          {unresolved.length > 0 && (
            <p className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <span>
                {unresolved.map((name) => `{{${name}}}`).join(', ')} cannot be filled and will be
                sent as empty space. Check the spelling against the picker.
              </span>
            </p>
          )}

          {preview ? (
            <TemplatePreview
              html={preview.html}
              text={preview.text}
              subject={preview.subject}
              mode={previewMode}
              device={device}
              onDeviceChange={setDevice}
              isLoading={isPreviewing}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-slate-400">
              A subject and a body are needed before anything can be previewed.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TemplateEditorPage
