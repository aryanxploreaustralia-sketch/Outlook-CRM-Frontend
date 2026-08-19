/**
 * The signed-in user's email signature.
 *
 * ## Why it reuses `RichTextEditor`
 *
 * A signature is email HTML with the same constraints as the message it sits
 * at the bottom of — it has to survive Outlook, so it needs the same inline
 * styles, the same table support and the same sanitiser. A second, simpler
 * editor here would produce markup the send pipeline treats differently from
 * everything else, which is exactly the drift worth avoiding.
 *
 * The image control comes with it, so a logo or banner can be embedded the same
 * way it is in a template.
 *
 * ## Preview
 *
 * The saved value is rendered rather than the draft. What the preview shows is
 * therefore what the server stored after sanitising — so if a rule stripped
 * something, the reader sees that rather than a preview that flatters the
 * editor.
 */

import { useCallback, useEffect, useState } from 'react'
import { Check, PenLine } from 'lucide-react'

import { fetchMySignature, saveMySignature } from '@/api/services/signature.service'
import { RichTextEditor } from '@/components/mail/RichTextEditor'
import { Card } from '@/components/common/Card'
import { Button } from '@/components/ui/Button'

export function SignatureEditor() {
  const [draft, setDraft] = useState('')
  const [saved, setSaved] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    let cancelled = false

    fetchMySignature()
      .then((html) => {
        if (cancelled) return
        setDraft(html)
        setSaved(html)
      })
      .catch(() => {
        if (!cancelled) setNotice({ tone: 'error', text: 'Your signature could not be loaded.' })
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const save = useCallback(async () => {
    setIsSaving(true)
    setNotice(null)

    try {
      // The response carries what was actually stored — sanitised — so the
      // editor and preview both reconcile to the server rather than to the
      // draft that was sent.
      const stored = await saveMySignature(draft)
      setSaved(stored)
      setDraft(stored)
      setNotice({ tone: 'success', text: stored === '' ? 'Signature cleared.' : 'Signature saved.' })
    } catch (thrown) {
      /*
       * The field-level message, not the envelope's.
       *
       * A Zod rejection arrives as 422 with a generic `message` — "The
       * submitted data failed validation" — and the useful sentence in
       * `details`. Showing the envelope tells the reader something went wrong
       * and nothing about what; the field message says the signature is too
       * large and to use a smaller logo, which is the only thing they can act
       * on.
       */
      const fieldMessage = Array.isArray(thrown?.details)
        ? thrown.details.find((issue) => issue?.message)?.message
        : (thrown?.details?.signatureHtml ?? null)

      setNotice({
        tone: 'error',
        text: fieldMessage ?? thrown?.message ?? 'Your signature could not be saved.',
      })
    } finally {
      setIsSaving(false)
    }
  }, [draft])

  return (
    <Card
      title="Email signature"
      description="Inserted into a message or template with the Signature button in the editor toolbar."
    >
      {notice && (
        <div
          role="status"
          className={`mb-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
            notice.tone === 'error'
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900'
          }`}
        >
          {notice.tone === 'success' && <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
          <p className="min-w-0">{notice.text}</p>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading your signature…</p>
      ) : (
        <>
          <RichTextEditor
            value={draft}
            onChange={setDraft}
            label="Signature"
            disabled={isSaving}
          />

          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              Formatting, links, tables and images are kept. Scripts are removed.
            </p>
            <Button size="sm" onClick={save} isLoading={isSaving} disabled={isSaving || draft === saved}>
              <PenLine className="size-3.5" aria-hidden="true" />
              Save signature
            </Button>
          </div>

          {saved && (
            <div className="mt-4 border-t border-slate-200 pt-3">
              <p className="text-xs font-medium text-slate-600">Saved signature</p>
              {/*
                The stored value, which the server already sanitised. This is
                the same content the toolbar button inserts, so the preview and
                the insertion cannot disagree.
              */}
              <div
                className="mt-2 rounded-lg border border-slate-200 bg-white p-3 text-sm"
                dangerouslySetInnerHTML={{ __html: saved }}
              />
            </div>
          )}
        </>
      )}
    </Card>
  )
}

export default SignatureEditor
