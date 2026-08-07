/**
 * Rendered preview of a template.
 *
 * ## Why an iframe
 *
 * The rendered HTML is a whole email document with its own inline styles. Drop
 * that into the page and two things happen: the application's stylesheet leaks
 * into the preview so it looks nothing like the real message, and the email's
 * own styles leak out into the application. A sandboxed iframe is the only way
 * to show what the recipient will actually see.
 *
 * `sandbox` with no `allow-scripts` also means a template containing a script —
 * whether written by mistake or pasted from somewhere unwise — cannot run
 * inside the CRM.
 */

import { useEffect, useRef } from 'react'
import { Monitor, Smartphone } from 'lucide-react'

import { PREVIEW_WIDTHS } from '@/constants/template.constants'

/**
 * @param {{
 *   html: string,
 *   text: string,
 *   subject: string,
 *   mode: 'html' | 'text',
 *   device: 'desktop' | 'mobile',
 *   onDeviceChange: (device: string) => void,
 *   isLoading?: boolean,
 * }} props
 */
export function TemplatePreview({
  html,
  text,
  subject,
  mode,
  device,
  onDeviceChange,
  isLoading = false,
}) {
  const frameRef = useRef(null)

  /**
   * Written through the document rather than `srcDoc`.
   *
   * `srcDoc` re-navigates the frame on every keystroke, which makes the preview
   * flicker white while someone is typing. Writing into the existing document
   * replaces the content in place.
   */
  useEffect(() => {
    if (mode !== 'html') return
    const frame = frameRef.current
    if (!frame) return

    const doc = frame.contentDocument
    if (!doc) return

    doc.open()
    doc.write(
      `<!doctype html><html><head><meta charset="utf-8">` +
        `<meta name="viewport" content="width=device-width,initial-scale=1">` +
        `<base target="_blank">` +
        `</head><body style="margin:0">${html ?? ''}</body></html>`,
    )
    doc.close()
  }, [html, mode, device])

  const { maxWidth } = PREVIEW_WIDTHS[device] ?? PREVIEW_WIDTHS.desktop

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* --- Subject, shown the way a mail client shows it ------------------- */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Subject</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-slate-900" title={subject}>
              {subject || <span className="font-normal italic text-slate-400">No subject</span>}
            </p>
          </div>

          {mode === 'html' && (
            <div className="flex shrink-0 rounded-lg border border-slate-200 p-0.5" role="group" aria-label="Preview width">
              {[
                { id: 'desktop', Icon: Monitor, label: 'Desktop' },
                { id: 'mobile', Icon: Smartphone, label: 'Mobile' },
              ].map(({ id, Icon, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onDeviceChange(id)}
                  aria-pressed={device === id}
                  title={label}
                  className={`rounded-md px-2 py-1 transition-colors ${
                    device === id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  <span className="sr-only">{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* --- Body ------------------------------------------------------------ */}
      <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-4">
        {isLoading ? (
          <div className="h-full animate-pulse rounded-lg bg-white/60" />
        ) : mode === 'text' ? (
          /*
           * The text alternative, shown as the recipient's client would: fixed
           * width, no styling, wrapping preserved. This is what lands in a
           * plain-text reader and in most spam filters' view of the message.
           */
          <pre className="mx-auto max-w-[72ch] whitespace-pre-wrap break-words rounded-lg bg-white p-4 font-mono text-xs leading-relaxed text-slate-700 ring-1 ring-slate-200">
            {text || 'No plain-text version.'}
          </pre>
        ) : (
          <div className="mx-auto transition-[max-width] duration-200" style={{ maxWidth }}>
            <iframe
              ref={frameRef}
              title="Email preview"
              // No allow-scripts: a template must never execute inside the CRM.
              sandbox="allow-same-origin"
              className="h-[70vh] w-full rounded-lg bg-white shadow-sm ring-1 ring-slate-200"
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default TemplatePreview
