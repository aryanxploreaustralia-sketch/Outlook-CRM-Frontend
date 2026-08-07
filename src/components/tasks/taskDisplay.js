/**
 * How a task reads: labels, colours and dates (Phase 18).
 *
 * Separate from the components that use them because a component file which
 * also exports constants defeats Fast Refresh — the same reason
 * `resolveAdminErrorVariant` lives beside the admin helpers rather than in
 * `AdminErrorState`.
 */

import { CheckCircle2, Circle, CircleDot, XCircle } from 'lucide-react'

/** Status → how it reads. Mirrors `TASK_STATUS_LABELS` on the server. */
export const TASK_STATUS_STYLES = {
  todo: { label: 'To do', icon: Circle, className: 'bg-slate-100 text-slate-600 ring-slate-200' },
  in_progress: {
    label: 'In progress',
    icon: CircleDot,
    className: 'bg-brand-50 text-brand-700 ring-brand-200',
  },
  done: {
    label: 'Done',
    icon: CheckCircle2,
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  },
  cancelled: {
    label: 'Cancelled',
    icon: XCircle,
    className: 'bg-slate-100 text-slate-500 ring-slate-200',
  },
}

/**
 * Priority → how it reads.
 *
 * `normal` is deliberately colourless. If every priority has a colour then
 * nothing stands out, and the two that matter — high and urgent — are the whole
 * point of the field.
 */
export const TASK_PRIORITY_STYLES = {
  low: { label: 'Low', className: 'text-slate-400' },
  normal: { label: 'Normal', className: 'text-slate-500' },
  high: { label: 'High', className: 'text-amber-600' },
  urgent: { label: 'Urgent', className: 'text-red-600' },
}

/** A short, human due date: "Today", "Tomorrow", "3 days ago", or a date. */
export function formatDue(value) {
  if (!value) return null

  const due = new Date(value)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const day = new Date(due)
  day.setHours(0, 0, 0, 0)

  const days = Math.round((day - today) / 86_400_000)

  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  if (days < 0) return `${Math.abs(days)} days ago`
  if (days <= 7) return `In ${days} days`

  return due.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export default TASK_STATUS_STYLES
