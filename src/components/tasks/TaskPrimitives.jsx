/**
 * The pieces every task surface shares (Phase 18).
 *
 * Extracted because the CRM page, the console widgets and the User 360 section
 * all render a task row, a status pill and a goal bar — and three hand-rolled
 * copies is how a "high" priority ends up amber in one place and red in another.
 *
 * ## Nothing here decides anything
 *
 * Every permission question is answered by the server and arrives on the task
 * as `canUpdateStatus` / `canComment`. These components read those flags. A
 * component that worked out "am I the assignee" from the session would be a
 * second copy of a rule the endpoints enforce, and the two would drift.
 */

import { AlertTriangle } from 'lucide-react'

import { UserAvatar } from '@/components/common/UserAvatar'
import {
  TASK_PRIORITY_STYLES,
  TASK_STATUS_STYLES,
  formatDue,
} from '@/components/tasks/taskDisplay'

/** The status pill. */
export function TaskStatusPill({ status, size = 'sm' }) {
  const style = TASK_STATUS_STYLES[status] ?? TASK_STATUS_STYLES.todo
  const Icon = style.icon

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full ring-1 ring-inset ${style.className} ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
      }`}
    >
      <Icon className="size-3" aria-hidden="true" />
      {style.label}
    </span>
  )
}

/**
 * The progress bar.
 *
 * Rendered even at zero, because an empty track says "nothing done yet" while a
 * missing bar says nothing at all.
 */
export function TaskProgress({ value = 0, className = '' }) {
  const width = Math.max(0, Math.min(100, Number(value) || 0))

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200"
        role="img"
        aria-label={`${width}% complete`}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-[--duration-slow] ${
            width === 100 ? 'bg-emerald-500' : 'bg-brand-600'
          }`}
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="w-9 shrink-0 text-right text-xs tabular-nums text-slate-500">{width}%</span>
    </div>
  )
}

/**
 * One task in a list.
 *
 * @param {{
 *   task: object,
 *   onOpen?: (task: object) => void,
 *   showAssignee?: boolean,
 *   compact?: boolean,
 * }} props
 */
export function TaskRow({ task, onOpen, showAssignee = false, compact = false }) {
  const priority = TASK_PRIORITY_STYLES[task.priority] ?? TASK_PRIORITY_STYLES.normal
  const due = formatDue(task.dueAt)

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen?.(task)}
        className="flex w-full items-start gap-3 rounded-[--radius-control] px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
      >
        <span className="mt-0.5 shrink-0">
          <TaskStatusPill status={task.status} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span
              className={`truncate text-sm font-medium ${
                task.isComplete ? 'text-slate-400 line-through' : 'text-slate-900'
              }`}
            >
              {task.title}
            </span>

            {task.priority !== 'normal' && (
              <span className={`text-xs font-medium ${priority.className}`}>{priority.label}</span>
            )}
          </span>

          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            {due && (
              <span className={task.isOverdue ? 'flex items-center gap-1 font-medium text-red-600' : ''}>
                {task.isOverdue && <AlertTriangle className="size-3" aria-hidden="true" />}
                {task.isOverdue ? `Overdue — due ${due.toLowerCase()}` : `Due ${due.toLowerCase()}`}
              </span>
            )}

            {showAssignee && task.assigneeUser && (
              <span className="flex items-center gap-1.5">
                <UserAvatar
                  name={task.assigneeUser.displayName}
                  email={task.assigneeUser.email}
                  size="xs"
                />
                {task.assigneeUser.displayName ?? task.assigneeUser.email}
              </span>
            )}

            {task.comments?.length > 0 && <span>{task.comments.length} comments</span>}
            {task.attachments?.length > 0 && <span>{task.attachments.length} files</span>}
          </span>

          {!compact && task.status === 'in_progress' && (
            <TaskProgress value={task.progress} className="mt-2 max-w-xs" />
          )}
        </span>
      </button>
    </li>
  )
}

/**
 * One goal, as a labelled bar.
 *
 * Shows the elapsed marker as well as the progress, because "60% done" means
 * something different on the 3rd of the month than on the 28th — and a bar
 * without that context invites the wrong conclusion in both directions.
 */
export function GoalBar({ goal }) {
  const percentage = goal.percentage ?? 0
  const width = Math.max(0, Math.min(100, percentage))

  const divisor = goal.displayDivisor ?? 1
  const unit = goal.displayUnit ?? goal.unit
  const shown = (value) =>
    divisor === 1 ? value.toLocaleString() : (value / divisor).toFixed(1)

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="text-sm font-medium text-slate-800">{goal.metricLabel}</span>
        <span className="text-xs tabular-nums text-slate-500">
          {shown(goal.current)} / {shown(goal.target)} {unit}
        </span>
      </div>

      <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full transition-[width] duration-[--duration-slow] ${
            goal.isAchieved ? 'bg-emerald-500' : goal.isBehind ? 'bg-amber-500' : 'bg-brand-600'
          }`}
          style={{ width: `${width}%` }}
        />

        {/* Where the period has got to. Not drawn once the window has closed —
            a marker pinned at the far right adds nothing but ink. */}
        {!goal.isExpired && (
          <span
            className="absolute inset-y-0 w-px bg-slate-500/40"
            style={{ left: `${goal.elapsedPercentage}%` }}
            aria-hidden="true"
          />
        )}
      </div>

      <p className="mt-1 text-xs text-slate-500">
        {goal.periodLabel}
        {goal.isAchieved ? (
          <span className="ml-1.5 font-medium text-emerald-700">Achieved</span>
        ) : goal.isExpired ? (
          <span className="ml-1.5 text-slate-400">Period closed</span>
        ) : goal.isBehind ? (
          <span className="ml-1.5 font-medium text-amber-700">
            Behind — {goal.elapsedPercentage}% of the period gone
          </span>
        ) : (
          <span className="ml-1.5">{goal.remaining.toLocaleString()} to go</span>
        )}
      </p>
    </div>
  )
}

export default TaskRow
