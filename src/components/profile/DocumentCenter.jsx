/**
 * The document centre.
 *
 * ## One component, two audiences
 *
 * The employee sees their own documents and can upload, replace and delete. An
 * owner or admin sees the same list from User 360 and can verify or reject.
 * Rather than two components that drift apart, this takes a `mode` and the
 * *server* decides what is permitted — `canReplace` and `canDelete` arrive on
 * every row, so the client never re-derives "is this verified".
 *
 * A third mode, `readonly`, is preview and download only. It is what an
 * administrator who can read the directory but not rule on documents sees:
 * the list is theirs to see, the decision is not theirs to make.
 *
 * ## The upload limits are the server's, echoed
 *
 * `limit` and `remaining` come from the API. Hardcoding "5" here would be a
 * second copy of a rule the server enforces, and the two would disagree the
 * first time it changed. The client-side size and type checks exist only to
 * give a fast, kind error — the server sniffs the real bytes regardless, so a
 * file that slips past these is still refused.
 */

import { useRef, useState } from 'react'
import {
  Check,
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  Trash2,
  Upload,
  X,
} from 'lucide-react'

import { AdminBadge } from '@/admin/components/AdminBadge'
import { AdminEmptyState } from '@/admin/components/AdminEmptyState'
import { AdminModal } from '@/admin/components/AdminModal'
import { AdminSelectField, AdminTextArea, AdminTextField } from '@/admin/components/AdminField'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/admin/utils/format'

/** Mirrors the server's `DOCUMENT_CATEGORY_LABELS`. Offered in the upload form. */
const CATEGORIES = [
  { value: 'aadhaar', label: 'Aadhaar card' },
  { value: 'pan', label: 'PAN card' },
  { value: 'passport', label: 'Passport' },
  { value: 'resume', label: 'Résumé' },
  { value: 'other', label: 'Other' },
]

const STATUS_TONE = { pending: 'warning', verified: 'success', rejected: 'danger' }

/** Client-side guards. Fast feedback only — the server is the authority. */
const MAX_BYTES = 10 * 1024 * 1024
const ACCEPT = 'application/pdf,image/png,image/jpeg'

function readableSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * @param {{
 *   data?: { items: object[], limit: number, remaining: number },
 *   isLoading?: boolean,
 *   mode?: 'employee' | 'admin' | 'readonly',
 *   fileUrl: (id: string, options?: { download?: boolean }) => string,
 *   onUpload?: (file: File, meta: object) => Promise<void>,
 *   onReplace?: (id: string, file: File) => Promise<void>,
 *   onDelete?: (id: string) => Promise<void>,
 *   onDecide?: (id: string, status: 'verified' | 'rejected', remarks: string) => Promise<void>,
 * }} props
 */
export function DocumentCenter({
  data,
  isLoading = false,
  mode = 'employee',
  fileUrl,
  onUpload,
  onReplace,
  onDelete,
  onDecide,
}) {
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [decision, setDecision] = useState(null)
  const [form, setForm] = useState({ title: '', category: '', description: '' })
  const [file, setFile] = useState(null)
  const [remarks, setRemarks] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState(null)

  const inputRef = useRef(null)
  const replaceRef = useRef(null)
  const [replacingId, setReplacingId] = useState(null)

  const items = data?.items ?? []
  const remaining = data?.remaining ?? 0
  const limit = data?.limit ?? 5

  /** Shared validation for both the upload and the replace paths. */
  const validate = (candidate) => {
    if (!candidate) return 'Choose a file.'
    if (candidate.size > MAX_BYTES) {
      return `That file is ${readableSize(candidate.size)}. The limit is 10 MB.`
    }
    if (!ACCEPT.split(',').includes(candidate.type)) {
      return 'Documents must be a PDF, PNG or JPEG.'
    }
    return null
  }

  const run = async (action) => {
    setIsBusy(true)
    setError(null)

    try {
      await action()
      setIsUploadOpen(false)
      setDecision(null)
      setForm({ title: '', category: '', description: '' })
      setFile(null)
      setRemarks('')
    } catch (caught) {
      setError(caught?.message ?? 'That could not be completed.')
    } finally {
      setIsBusy(false)
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2].map((n) => (
          <div key={n} className="skeleton h-28" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* --- Slots + upload ---------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {items.length} of {limit} documents
          {mode === 'employee' && remaining > 0 && (
            <span className="text-slate-400"> · {remaining} slot{remaining === 1 ? '' : 's'} free</span>
          )}
        </p>

        {mode === 'employee' && (
          <Button
            size="sm"
            disabled={remaining === 0}
            onClick={() => {
              setError(null)
              setIsUploadOpen(true)
            }}
            // Says why rather than leaving a dead control to be puzzled over.
            title={remaining === 0 ? `You have reached the limit of ${limit} documents.` : undefined}
          >
            <Upload className="size-3.5" aria-hidden="true" />
            Upload document
          </Button>
        )}
      </div>

      {/* --- The list ------------------------------------------------------ */}
      {items.length === 0 ? (
        <AdminEmptyState
          title="No documents yet"
          description={
            mode === 'employee'
              ? 'Upload identity documents or a résumé. PDF, PNG or JPEG, up to 10 MB each.'
              : 'This employee has not uploaded any documents.'
          }
          compact
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((document) => {
            const Icon = document.mimeType === 'application/pdf' ? FileText : ImageIcon

            return (
              <li key={document.id} className="surface-card p-4">
                <div className="flex items-start gap-3">
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-(--radius-control) bg-slate-100 text-slate-500"
                    aria-hidden="true"
                  >
                    <Icon className="size-4" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{document.title}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {document.categoryLabel} · {readableSize(document.size)} ·{' '}
                      {formatDate(document.uploadedAt)}
                    </p>
                  </div>

                  <AdminBadge tone={STATUS_TONE[document.status] ?? 'neutral'} dot>
                    {document.statusLabel}
                  </AdminBadge>
                </div>

                {/* The reviewer's note. Shown to both sides — an employee whose
                    document was rejected needs to read why. */}
                {document.remarks && (
                  <p className="mt-2.5 rounded-(--radius-control) bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    {document.remarks}
                    {document.verifiedByEmail && (
                      <span className="mt-0.5 block text-slate-400">
                        — {document.verifiedByEmail}
                      </span>
                    )}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3">
                  <Button as="a" href={fileUrl(document.id)} target="_blank" rel="noreferrer" size="sm" variant="ghost">
                    <Eye className="size-3.5" aria-hidden="true" />
                    Preview
                  </Button>

                  <Button as="a" href={fileUrl(document.id, { download: true })} size="sm" variant="ghost">
                    <Download className="size-3.5" aria-hidden="true" />
                    Download
                  </Button>

                  {mode === 'employee' && document.canReplace && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setReplacingId(document.id)
                        replaceRef.current?.click()
                      }}
                    >
                      <Upload className="size-3.5" aria-hidden="true" />
                      Replace
                    </Button>
                  )}

                  {mode === 'employee' && document.canDelete && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => run(() => onDelete(document.id))}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      Delete
                    </Button>
                  )}

                  {mode === 'admin' && document.status !== 'verified' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto text-emerald-700 hover:bg-emerald-50"
                      onClick={() => {
                        setRemarks('')
                        setError(null)
                        setDecision({ id: document.id, status: 'verified', title: document.title })
                      }}
                    >
                      <Check className="size-3.5" aria-hidden="true" />
                      Verify
                    </Button>
                  )}

                  {mode === 'admin' && document.status !== 'rejected' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => {
                        setRemarks('')
                        setError(null)
                        setDecision({ id: document.id, status: 'rejected', title: document.title })
                      }}
                    >
                      <X className="size-3.5" aria-hidden="true" />
                      Reject
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Hidden input for the replace flow. One element reused by every row —
          five hidden inputs would be five things to keep in step. */}
      <input
        ref={replaceRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(event) => {
          const candidate = event.target.files?.[0]
          event.target.value = ''

          const invalid = validate(candidate)
          if (invalid) { setError(invalid); return }

          run(() => onReplace(replacingId, candidate))
        }}
      />

      {error && !isUploadOpen && !decision && (
        <p role="alert" className="rounded-(--radius-control) border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {/* --- Upload -------------------------------------------------------- */}
      <AdminModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        title="Upload a document"
        busy={isBusy}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsUploadOpen(false)} disabled={isBusy}>
              Cancel
            </Button>
            <Button
              isLoading={isBusy}
              disabled={!file || !form.title.trim() || !form.category}
              onClick={() => {
                const invalid = validate(file)
                if (invalid) { setError(invalid); return }

                run(() =>
                  onUpload(file, {
                    title: form.title.trim(),
                    category: form.category,
                    description: form.description.trim() || null,
                  }),
                )
              }}
            >
              Upload
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <AdminTextField
            label="Title"
            value={form.title}
            onChange={(value) => setForm((previous) => ({ ...previous, title: value }))}
            placeholder="Passport"
            required
          />

          <AdminSelectField
            label="Category"
            value={form.category}
            onChange={(value) => setForm((previous) => ({ ...previous, category: value }))}
            options={CATEGORIES}
            placeholder="Choose a category…"
            required
          />

          <AdminTextArea
            label="Description (optional)"
            value={form.description}
            onChange={(value) => setForm((previous) => ({ ...previous, description: value }))}
            rows={2}
            maxLength={512}
          />

          <div>
            <span className="block text-sm font-medium text-slate-700">File</span>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-1.5 flex w-full items-center gap-3 rounded-(--radius-control) border border-dashed border-slate-300 px-4 py-5 text-left transition-colors hover:border-brand-400 hover:bg-brand-50/30"
            >
              <Upload className="size-5 shrink-0 text-slate-400" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block truncate text-sm text-slate-700">
                  {file ? file.name : 'Choose a file'}
                </span>
                <span className="block text-xs text-slate-400">
                  {file ? readableSize(file.size) : 'PDF, PNG or JPEG · up to 10 MB'}
                </span>
              </span>
            </button>

            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(event) => {
                const candidate = event.target.files?.[0] ?? null
                setError(validate(candidate))
                setFile(candidate)

                // Fills the title from the filename when it is still blank —
                // saves retyping "passport" for the file called passport.pdf.
                if (candidate && !form.title.trim()) {
                  setForm((previous) => ({
                    ...previous,
                    title: candidate.name.replace(/\.[^.]+$/, '').slice(0, 160),
                  }))
                }
              }}
            />
          </div>

          {error && (
            <p role="alert" className="rounded-(--radius-control) border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}
        </div>
      </AdminModal>

      {/* --- Verify / reject ------------------------------------------------ */}
      <AdminModal
        isOpen={Boolean(decision)}
        onClose={() => setDecision(null)}
        title={decision?.status === 'verified' ? 'Verify this document?' : 'Reject this document?'}
        busy={isBusy}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDecision(null)} disabled={isBusy}>
              Cancel
            </Button>
            <Button
              isLoading={isBusy}
              // A rejection needs a reason. The server enforces this too; the
              // disabled button just avoids a round trip to be told so.
              disabled={decision?.status === 'rejected' && !remarks.trim()}
              onClick={() => run(() => onDecide(decision.id, decision.status, remarks))}
            >
              {decision?.status === 'verified' ? 'Verify' : 'Reject'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            <span className="font-medium">{decision?.title}</span>
            {decision?.status === 'verified'
              ? ' will be marked verified. The employee will no longer be able to change or remove it.'
              : ' will be marked rejected. The employee can replace it, which returns it to pending.'}
          </p>

          <AdminTextArea
            label={decision?.status === 'rejected' ? 'Reason (required)' : 'Remarks (optional)'}
            value={remarks}
            onChange={setRemarks}
            rows={3}
            maxLength={512}
            placeholder={
              decision?.status === 'rejected'
                ? 'What is wrong with it, and what should they send instead?'
                : 'Anything worth recording alongside the decision.'
            }
          />

          {error && (
            <p role="alert" className="rounded-(--radius-control) border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}
        </div>
      </AdminModal>
    </div>
  )
}

export default DocumentCenter
