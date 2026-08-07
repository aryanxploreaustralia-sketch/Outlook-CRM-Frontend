/**
 * Compose and send a message.
 *
 * Layout and orchestration only — recipients, the editor and attachments are
 * each their own component, and the transport lives in `mail.service`. This file
 * holds the form state and the two submit paths.
 *
 * Cc and Bcc start hidden. Most messages need neither, and showing five empty
 * fields makes the common case look more complicated than it is; the toggles
 * reveal them and stay revealed once a value exists.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle2, FileText, Send, Trash2 } from 'lucide-react'

import { saveDraft, sendMail } from '@/api/services/mail.service'
import { fetchTemplate, fetchTemplates } from '@/api/services/template.service'
import { AttachmentPicker } from '@/components/mail/AttachmentPicker'
import { RecipientInput } from '@/components/mail/RecipientInput'
import { RichTextEditor } from '@/components/mail/RichTextEditor'
import { Button } from '@/components/ui/Button'
import { MAIL_LIMIT_FALLBACKS } from '@/constants/mail.constants'
import { useAuth } from '@/hooks/useAuth'
import { ROUTE_PATHS } from '@/routes/paths'

/** The empty form. Held as a factory so a reset always gets fresh arrays. */
const emptyForm = () => ({
  to: [],
  cc: [],
  bcc: [],
  subject: '',
  html: '',
  attachments: [],
})

export function ComposePage() {
  const navigate = useNavigate()
  const auth = useAuth()

  const [form, setForm] = useState(emptyForm)
  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)

  /**
   * Which mailbox this message goes out from.
   *
   * `null` means "the workspace default", which is what the server applies when
   * the field is absent. Kept as null rather than eagerly set to the default id
   * so that a user who never touches the picker sends from whatever the default
   * is *at send time* — if somebody changes it in another tab while a message is
   * being written, the message follows the change rather than a stale id.
   */
  const [mailboxId, setMailboxId] = useState(null)

  const sendableMailboxes = auth.sendableMailboxes ?? []
  const hasMailbox = sendableMailboxes.length > 0

  /**
   * The mailbox shown in the picker.
   *
   * With one mailbox there is nothing to choose, so it is shown as fixed text
   * rather than a one-option dropdown pretending to be a decision.
   */
  const selectedMailbox =
    sendableMailboxes.find((mailbox) => mailbox.id === mailboxId) ??
    sendableMailboxes.find((mailbox) => mailbox.isDefault) ??
    sendableMailboxes[0] ??
    null

  const [isSending, setIsSending] = useState(false)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [feedback, setFeedback] = useState(null)

  // --- Templates -------------------------------------------------------------
  //
  // Provenance, not content: `template` records which template the message was
  // started from. The user is free to edit afterwards, and what actually goes
  // out is whatever is in the form at send time.
  const [templates, setTemplates] = useState([])
  const [template, setTemplate] = useState(null)
  const [isApplying, setIsApplying] = useState(false)

  /** Updates one field without disturbing the rest. */
  const setField = useCallback((field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    // Any edit invalidates the previous result — leaving a stale "Sent" banner
    // above a half-written message would be actively misleading.
    setFeedback(null)
  }, [])

  // The library, for the "start from a template" picker. A failure here is not
  // worth surfacing — composing by hand still works, which is the default.
  useEffect(() => {
    const controller = new AbortController()

    fetchTemplates({}, { signal: controller.signal })
      .then((result) => setTemplates(result.items ?? []))
      .catch(() => setTemplates([]))

    return () => controller.abort()
  }, [])

  /**
   * Applies a template to the form.
   *
   * Overwrites the subject and body, which is the point of choosing one — but
   * only after confirming when there is something to lose. The list response
   * omits bodies, so the full template is fetched here.
   */
  const applyTemplate = useCallback(
    async (id) => {
      if (!id) {
        setTemplate(null)
        return
      }

      setIsApplying(true)
      setFeedback(null)

      try {
        const full = await fetchTemplate(id)
        if (!full) return

        setForm((current) => ({ ...current, subject: full.subject, html: full.bodyHtml }))
        setTemplate({ id: full.id, name: full.name, version: full.version })
      } catch {
        setFeedback({
          tone: 'error',
          message: 'That template could not be loaded. The message is unchanged.',
        })
      } finally {
        setIsApplying(false)
      }
    },
    [],
  )

  const bodyIsEmpty = useMemo(() => {
    // Tags are stripped before the check: an editor left untouched still holds
    // markup like `<br>`, which is not content the user typed.
    const text = form.html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
    return text === '' && form.attachments.length === 0
  }, [form.html, form.attachments])

  // Sending additionally requires a mailbox. Composing, editing and saving the
  // form do not — the page stays fully usable so a user can write the message
  // and connect a mailbox afterwards, rather than being locked out of the page.
  const canSend = form.to.length > 0 && !bodyIsEmpty && !isSending && !isSavingDraft && hasMailbox
  const hasContent =
    form.to.length > 0 ||
    form.cc.length > 0 ||
    form.bcc.length > 0 ||
    form.subject.trim() !== '' ||
    !bodyIsEmpty

  /** Strips the transport-only `size` field the API does not accept. */
  const buildPayload = useCallback(
    () => ({
      to: form.to,
      cc: form.cc,
      bcc: form.bcc,
      subject: form.subject,
      html: form.html,
      attachments: form.attachments.map(({ name, contentType, contentBytes }) => ({
        name,
        contentType,
        contentBytes,
      })),
      // Recorded in mail history so a message can be traced back to the wording
      // it started from. Omitted entirely when composing from scratch.
      ...(template
        ? { templateId: template.id, templateName: template.name, templateVersion: template.version }
        : {}),
      // Omitted unless the user actively chose a sender, so the server applies
      // the workspace default — the behaviour every existing client relies on.
      ...(mailboxId ? { mailboxId } : {}),
    }),
    [form, template, mailboxId],
  )

  const handleSend = useCallback(async () => {
    setIsSending(true)
    setFeedback(null)

    try {
      const record = await sendMail(buildPayload())

      setFeedback({
        tone: 'success',
        message: `Message sent to ${record.to.length} recipient${record.to.length === 1 ? '' : 's'}.`,
        mailId: record.id,
      })

      // Cleared only on success, so a failed send leaves the message intact and
      // the user can retry without retyping it.
      setForm(emptyForm())
      setShowCc(false)
      setShowBcc(false)
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error?.message ?? 'The message could not be sent.',
        // Present when the server recorded the failed attempt, which lets the
        // user open the record and see exactly what Graph said.
        mailId: error?.details?.mailId ?? null,
        fields: Array.isArray(error?.details) ? error.details : null,
      })
    } finally {
      setIsSending(false)
    }
  }, [buildPayload])

  const handleSaveDraft = useCallback(async () => {
    setIsSavingDraft(true)
    setFeedback(null)

    try {
      const record = await saveDraft(buildPayload())

      setFeedback({
        tone: 'success',
        message: record.graphMessageId
          ? 'Draft saved to your Outlook drafts folder.'
          : 'Draft saved.',
        mailId: record.id,
      })
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: error?.message ?? 'The draft could not be saved.',
        fields: Array.isArray(error?.details) ? error.details : null,
      })
    } finally {
      setIsSavingDraft(false)
    }
  }, [buildPayload])

  const handleDiscard = useCallback(() => {
    if (hasContent && !window.confirm('Discard this message?')) return

    setForm(emptyForm())
    setShowCc(false)
    setShowBcc(false)
    setFeedback(null)
  }, [hasContent])

  const isBusy = isSending || isSavingDraft

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* --- Heading -------------------------------------------------------- */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          Compose message
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Sent through a connected mailbox and recorded in your history.
        </p>
      </div>

      {/* --- Result banner -------------------------------------------------- */}
      {feedback && (
        <div
          role="alert"
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
            feedback.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {feedback.tone === 'success' ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          ) : (
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          )}

          <div className="min-w-0 flex-1">
            <p className="font-medium">{feedback.message}</p>

            {/* Field-level validation detail from the server's 422. */}
            {feedback.fields && (
              <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs">
                {feedback.fields.map((issue, index) => (
                  <li key={index}>
                    <span className="font-medium">{issue.field}</span>: {issue.message}
                  </li>
                ))}
              </ul>
            )}

            {feedback.mailId && (
              <button
                type="button"
                onClick={() => navigate(ROUTE_PATHS.MAIL)}
                className="mt-1.5 text-xs font-medium underline underline-offset-2"
              >
                View in history
              </button>
            )}
          </div>
        </div>
      )}

      {/*
        --- No mailbox connected ------------------------------------------
        A notice, not a block. The CRM session is perfectly valid and the page
        remains fully usable; only the send button is unavailable, and the
        remedy is one link away.
      */}
      {auth.isReady && !hasMailbox && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">No mailbox connected.</p>
            <p className="mt-0.5">
              You can write this message, but it cannot be sent until a Microsoft mailbox is
              connected.{' '}
              <Link
                to={ROUTE_PATHS.ACCOUNT}
                className="font-medium underline underline-offset-2 hover:text-amber-950"
              >
                Connect one from Account
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      {/* --- Form ----------------------------------------------------------- */}
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {/*
          --- Send from ----------------------------------------------------
          Shown only when there is a mailbox. With exactly one it is a
          statement of fact rather than a dropdown, because a picker with one
          option asks the user to make a decision that does not exist.
        */}
        {hasMailbox && (
          <div>
            <label
              htmlFor="mail-sender"
              className="mb-1.5 block text-xs font-medium text-slate-600"
            >
              Send from
            </label>

            {sendableMailboxes.length === 1 ? (
              <p
                id="mail-sender"
                className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-inset ring-slate-200"
              >
                {selectedMailbox?.emailAddress ?? 'Your connected mailbox'}
              </p>
            ) : (
              <select
                id="mail-sender"
                value={selectedMailbox?.id ?? ''}
                onChange={(event) => setMailboxId(event.target.value)}
                disabled={isBusy}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 disabled:bg-slate-100"
              >
                {sendableMailboxes.map((mailbox) => (
                  <option key={mailbox.id} value={mailbox.id}>
                    {mailbox.emailAddress ?? mailbox.displayName}
                    {mailbox.isDefault ? ' (default)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        <RecipientInput
          label="To"
          value={form.to}
          onChange={(next) => setField('to', next)}
          maxRecipients={MAIL_LIMIT_FALLBACKS.maxRecipients}
          autoFocus
          action={
            <div className="flex gap-2 text-xs">
              {!showCc && (
                <button
                  type="button"
                  onClick={() => setShowCc(true)}
                  className="font-medium text-slate-500 transition-colors hover:text-brand-600"
                >
                  Cc
                </button>
              )}
              {!showBcc && (
                <button
                  type="button"
                  onClick={() => setShowBcc(true)}
                  className="font-medium text-slate-500 transition-colors hover:text-brand-600"
                >
                  Bcc
                </button>
              )}
            </div>
          }
        />

        {showCc && (
          <RecipientInput
            label="Cc"
            value={form.cc}
            onChange={(next) => setField('cc', next)}
            maxRecipients={MAIL_LIMIT_FALLBACKS.maxRecipients}
          />
        )}

        {showBcc && (
          <RecipientInput
            label="Bcc"
            value={form.bcc}
            onChange={(next) => setField('bcc', next)}
            maxRecipients={MAIL_LIMIT_FALLBACKS.maxRecipients}
            // Worth stating: recipients here are hidden from everyone else, and
            // people misuse Bcc precisely because they are unsure of that.
            placeholder="Hidden from other recipients"
          />
        )}

        {/* --- Start from a template ---------------------------------------- */}
        {templates.length > 0 && (
          <div className="flex flex-wrap items-end gap-3 rounded-lg bg-slate-50 p-3 ring-1 ring-inset ring-slate-200">
            <div className="min-w-48 flex-1">
              <label htmlFor="mail-template" className="mb-1.5 block text-xs font-medium text-slate-600">
                Start from a template
              </label>
              <select
                id="mail-template"
                value={template?.id ?? ''}
                onChange={(event) => applyTemplate(event.target.value)}
                disabled={isBusy || isApplying}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 disabled:bg-slate-100"
              >
                <option value="">Compose from scratch</option>
                {templates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.status === 'active' ? ' (active)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <p className="flex-1 text-xs text-slate-500">
              {template ? (
                <>
                  Started from <strong>{template.name}</strong> v{template.version}. Edit freely — what
                  you send is what is below, and mail history records where it came from.
                </>
              ) : (
                'Applying a template replaces the subject and body. Variables are not substituted here; this is a one-off message, so write the details in directly.'
              )}
            </p>

            <Button as={Link} to={ROUTE_PATHS.TEMPLATES} variant="ghost" size="sm">
              Manage
            </Button>
          </div>
        )}

        <div>
          <label htmlFor="mail-subject" className="mb-1.5 block text-xs font-medium text-slate-600">
            Subject
          </label>
          <input
            id="mail-subject"
            type="text"
            value={form.subject}
            onChange={(event) => setField('subject', event.target.value)}
            placeholder="What is this about?"
            maxLength={998}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
          />
        </div>

        <RichTextEditor
          value={form.html}
          onChange={(html) => setField('html', html)}
          disabled={isBusy}
        />

        <AttachmentPicker
          attachments={form.attachments}
          onChange={(next) => setField('attachments', next)}
          maxAttachments={MAIL_LIMIT_FALLBACKS.maxAttachments}
          maxTotalBytes={MAIL_LIMIT_FALLBACKS.maxAttachmentBytes}
          disabled={isBusy}
        />
      </div>

      {/* --- Actions -------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={handleDiscard}
          disabled={isBusy || !hasContent}
          className="text-slate-500"
        >
          <Trash2 className="size-4" aria-hidden="true" />
          Discard
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={handleSaveDraft}
            isLoading={isSavingDraft}
            loadingLabel="Saving…"
            disabled={!hasContent || isSending}
          >
            <FileText className="size-4" aria-hidden="true" />
            Save draft
          </Button>

          <Button
            onClick={handleSend}
            isLoading={isSending}
            loadingLabel="Sending…"
            disabled={!canSend}
            // Explains the disabled state instead of leaving the user guessing.
            title={
              form.to.length === 0
                ? 'Add at least one recipient'
                : bodyIsEmpty
                  ? 'Add a message body or an attachment'
                  : undefined
            }
          >
            <Send className="size-4" aria-hidden="true" />
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ComposePage
