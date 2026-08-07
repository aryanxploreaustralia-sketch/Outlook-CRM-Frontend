/**
 * Shared audit vocabulary.
 *
 * The severity and result badges live here rather than in each page because
 * they encode a judgement — which events read as routine and which as alarming
 * — and two copies of that judgement drift.
 *
 * ## Labels come from the server
 *
 * `actionLabel` and `categoryLabel` arrive on every row, derived from the event
 * registry. Nothing in this module maps an action string to English: a second
 * mapping in React would go stale the first time an event was renamed, and the
 * failure would be silent — the log would just show raw dotted strings for the
 * newest events, which are the ones anybody is reading it for.
 */

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'

import { AdminBadge } from '@/admin/components/AdminBadge'
import {
  RESULT_LABEL,
  RESULT_TONE,
  SEVERITY_LABEL,
  SEVERITY_TONE,
} from '@/admin/constants/audit.constants'

/** The outcome badge. Shown on every row — a log of only successes is not one. */
export function AuditResultBadge({ result, reason }) {
  return (
    <AdminBadge tone={RESULT_TONE[result] ?? 'neutral'} dot title={reason ?? undefined}>
      {RESULT_LABEL[result] ?? result}
    </AdminBadge>
  )
}

export function AuditSeverityBadge({ severity }) {
  return (
    <AdminBadge tone={SEVERITY_TONE[severity] ?? 'neutral'}>
      {SEVERITY_LABEL[severity] ?? severity}
    </AdminBadge>
  )
}

/**
 * A collapsible JSON viewer.
 *
 * Dependency-free, matching the rest of this module. A tree widget would be
 * ~40 KB to render objects that are four levels deep at most — the recorder
 * caps them there — and the two things a reader actually needs are "show me the
 * shape" and "let me copy it", both of which are below.
 *
 * Rendered from the already-redacted payload. Anything credential-shaped was
 * destroyed server-side before storage, so `[redacted]` markers appear here as
 * ordinary strings and there is nothing to hide at render time.
 */
export function AuditJsonViewer({ value, label = 'Metadata' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  if (value === null || value === undefined) {
    return <p className="text-sm text-slate-500">No additional detail was recorded.</p>
  }

  const text = JSON.stringify(value, null, 2)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be refused — an insecure origin, or a denied
      // permission. The text is on screen and selectable either way, so this
      // fails quietly rather than raising an error about a convenience.
    }
  }

  return (
    <div className="rounded-lg border border-slate-200">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
        <button
          type="button"
          onClick={() => setIsOpen((previous) => !previous)}
          aria-expanded={isOpen}
          className="flex flex-1 items-center gap-1.5 text-left text-xs font-medium text-slate-700 hover:text-brand-600"
        >
          <ChevronRight
            className={`size-3.5 transition-transform ${isOpen ? 'rotate-90' : ''}`}
            aria-hidden="true"
          />
          {label}
        </button>

        <button
          type="button"
          onClick={copy}
          className="rounded px-2 py-0.5 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {isOpen && (
        // Its own horizontal scroll: a long value must not widen the drawer.
        <pre className="max-h-80 overflow-auto px-3 py-2 text-xs leading-relaxed text-slate-700">
          {text}
        </pre>
      )}
    </div>
  )
}
