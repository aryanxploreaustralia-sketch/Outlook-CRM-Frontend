/**
 * Attachment selector.
 *
 * Files are read to base64 as they are added rather than on send. That is the
 * deliberate choice: reading several megabytes at the moment the user clicks
 * Send would freeze the UI at the worst possible time, whereas doing it on
 * selection puts the cost where a short spinner is expected.
 *
 * The total-size limit is enforced here as well as on the server. Not for
 * security — the server's check is the one that counts — but because letting a
 * user fill in a message and only learn on send that it is 2 MB over the limit
 * is a bad experience the round trip does nothing to improve.
 */

import { useCallback, useRef, useState } from 'react'
import { Loader2, Paperclip, X } from 'lucide-react'

import { fileToAttachment } from '@/api/services/mail.service'
import { formatBytes } from '@/constants/mail.constants'

/**
 * @param {{
 *   attachments: Array<{ name: string, contentType: string, contentBytes: string, size: number }>,
 *   onChange: (next: Array<object>) => void,
 *   maxAttachments?: number,
 *   maxTotalBytes?: number,
 *   disabled?: boolean,
 * }} props
 */
export function AttachmentPicker({
  attachments,
  onChange,
  maxAttachments = 10,
  maxTotalBytes = 3 * 1024 * 1024,
  disabled = false,
}) {
  const inputRef = useRef(null)
  const [isReading, setIsReading] = useState(false)
  const [error, setError] = useState(null)

  const usedBytes = attachments.reduce((sum, file) => sum + file.size, 0)
  const remainingBytes = Math.max(0, maxTotalBytes - usedBytes)
  const usedPercent = Math.min(100, Math.round((usedBytes / maxTotalBytes) * 100))

  const addFiles = useCallback(
    async (fileList) => {
      const incoming = [...fileList]
      if (incoming.length === 0) return

      setError(null)

      const room = maxAttachments - attachments.length
      if (room <= 0) {
        setError(`You can attach at most ${maxAttachments} files.`)
        return
      }

      const accepted = incoming.slice(0, room)
      const rejected = []

      // Budget is tracked across the batch, so selecting five files at once is
      // checked the same way as adding them one at a time.
      let budget = remainingBytes
      const withinBudget = []

      for (const file of accepted) {
        if (file.size > budget) {
          rejected.push(file.name)
        } else {
          budget -= file.size
          withinBudget.push(file)
        }
      }

      if (withinBudget.length > 0) {
        setIsReading(true)
        try {
          const encoded = await Promise.all(withinBudget.map(fileToAttachment))
          onChange([...attachments, ...encoded])
        } catch (caught) {
          setError(caught.message ?? 'One of the files could not be read.')
        } finally {
          setIsReading(false)
        }
      }

      const messages = []
      if (rejected.length > 0) {
        messages.push(
          `${rejected.join(', ')} skipped — the ${formatBytes(maxTotalBytes)} total limit would be exceeded.`,
        )
      }
      if (incoming.length > room) {
        messages.push(`Only ${room} more file(s) can be attached.`)
      }
      if (messages.length > 0) setError(messages.join(' '))
    },
    [attachments, onChange, maxAttachments, remainingBytes, maxTotalBytes],
  )

  const handleSelect = useCallback(
    (event) => {
      void addFiles(event.target.files ?? [])
      // Reset so selecting the same file twice in a row still fires `change`.
      event.target.value = ''
    },
    [addFiles],
  )

  const remove = useCallback(
    (index) => {
      onChange(attachments.filter((_, position) => position !== index))
      setError(null)
    },
    [attachments, onChange],
  )

  const isFull = attachments.length >= maxAttachments

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-600">
          Attachments
          {attachments.length > 0 && (
            <span className="ml-1.5 font-normal text-slate-400">
              ({attachments.length}/{maxAttachments} · {formatBytes(usedBytes)} of{' '}
              {formatBytes(maxTotalBytes)})
            </span>
          )}
        </span>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || isReading || isFull}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isReading ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Paperclip className="size-3.5" aria-hidden="true" />
          )}
          {isReading ? 'Reading…' : 'Add files'}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        onChange={handleSelect}
        className="sr-only"
        aria-label="Choose files to attach"
      />

      {attachments.length > 0 && (
        <>
          <ul className="mb-2 space-y-1.5">
            {attachments.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2"
              >
                <Paperclip className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />

                <span className="min-w-0 flex-1 truncate text-xs text-slate-700" title={file.name}>
                  {file.name}
                </span>

                <span className="shrink-0 text-[11px] text-slate-400">
                  {formatBytes(file.size)}
                </span>

                <button
                  type="button"
                  onClick={() => remove(index)}
                  disabled={disabled}
                  className="grid size-5 shrink-0 place-items-center rounded text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 disabled:opacity-50"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>

          {/* Shows how close the message is to the limit before it is rejected. */}
          <div
            className="h-1 overflow-hidden rounded-full bg-slate-200"
            role="progressbar"
            aria-valuenow={usedPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Attachment size used"
          >
            <div
              className={`h-full rounded-full transition-all ${
                usedPercent > 90 ? 'bg-red-500' : usedPercent > 70 ? 'bg-amber-500' : 'bg-brand-500'
              }`}
              style={{ width: `${usedPercent}%` }}
            />
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="mt-1.5 text-xs text-red-600">
          {error}
        </p>
      )}

      {attachments.length === 0 && !error && (
        <p className="text-xs text-slate-400">
          Up to {maxAttachments} files, {formatBytes(maxTotalBytes)} in total.
        </p>
      )}
    </div>
  )
}

export default AttachmentPicker
