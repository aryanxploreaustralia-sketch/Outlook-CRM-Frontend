/**
 * The console's task widgets (Phase 18).
 *
 * ## Why these six and not a chart
 *
 * The brief asks for due today, overdue, completed today, goal progress, top
 * performers and who needs attention. Five of those are answers to "what should
 * somebody do in the next ten minutes", and a chart is the wrong shape for that
 * — it shows a trend when what is wanted is a list of names.
 *
 * Top performers already exist on this page from Phase 17.3, so this component
 * deliberately does not restate them. Two "top performer" cards computed from
 * different things would be two answers to one question.
 *
 * ## Nothing is counted here
 *
 * Every figure comes from `/tasks/highlights`, which reads the task service and
 * the performance engine. The component formats.
 */

import { AlertTriangle, CalendarClock, CheckCircle2, ListTodo } from 'lucide-react'

import { AdminCard } from '@/admin/components/AdminCard'
import { AdminStatCard } from '@/admin/components/AdminStatCard'
import { GoalBar, TaskStatusPill } from '@/components/tasks/TaskPrimitives'
import { formatDue } from '@/components/tasks/taskDisplay'
import { UserAvatar } from '@/components/common/UserAvatar'

/** A short list of tasks, each naming who owes it. */
function TaskList({ items, empty, showDue = true }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-400">{empty}</p>
  }

  return (
    <ul className="space-y-2">
      {items.map((task) => (
        <li key={task.id} className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block truncate text-sm text-slate-800">{task.title}</span>
            <span className="text-xs text-slate-500">{task.assigneeName}</span>
          </span>

          {showDue && task.dueAt && (
            <span
              className={`shrink-0 text-xs ${
                new Date(task.dueAt) < new Date() ? 'font-medium text-red-600' : 'text-slate-400'
              }`}
            >
              {formatDue(task.dueAt)}
            </span>
          )}

          {!showDue && task.completedAt && (
            <span className="shrink-0 text-xs text-emerald-600">
              {new Date(task.completedAt).toLocaleTimeString('en-AU', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

/**
 * @param {{ data: ?object, isLoading?: boolean }} props
 */
export function TaskWidgets({ data, isLoading = false }) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="skeleton h-28" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((n) => (
            <div key={n} className="skeleton h-48" />
          ))}
        </div>
      </div>
    )
  }

  if (!data) return null

  const { summary } = data

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Open tasks" value={summary.open} icon={ListTodo} />
        <AdminStatCard
          label="Due today"
          value={summary.dueToday}
          icon={CalendarClock}
          tone={summary.dueToday > 0 ? 'warning' : 'neutral'}
        />
        <AdminStatCard
          label="Overdue"
          value={summary.overdue}
          icon={AlertTriangle}
          tone={summary.overdue > 0 ? 'danger' : 'neutral'}
        />
        <AdminStatCard
          label="Completed today"
          value={summary.completedToday}
          icon={CheckCircle2}
          tone="success"
          hint={
            summary.completionRate === null
              ? 'No tasks assigned yet'
              : `${summary.completionRate}% of everything assigned`
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <AdminCard title="Due today">
          <TaskList items={data.dueToday} empty="Nothing falls due today." />
        </AdminCard>

        <AdminCard title="Overdue">
          <TaskList items={data.overdue} empty="Nothing is late." />
        </AdminCard>

        <AdminCard title="Completed today">
          <TaskList items={data.completedToday} empty="Nothing finished yet today." showDue={false} />
        </AdminCard>
      </div>

      {data.behind.length > 0 && (
        <AdminCard
          title="Carrying late work"
          description="Ranked by how many deadlines have passed. Distinct from the performance attention list above, which is about profiles and mailboxes."
        >
          <ul className="divide-y divide-slate-100">
            {data.behind.map((person) => (
              <li key={person.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="flex min-w-0 items-center gap-2.5">
                  <UserAvatar name={person.displayName} email={person.email} size="xs" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-800">
                      {person.displayName ?? person.email}
                    </span>
                    <span className="text-xs text-slate-500">
                      {person.open} open
                      {person.completionRate === null
                        ? ''
                        : ` · ${person.completionRate}% completed overall`}
                    </span>
                  </span>
                </span>

                <span className="shrink-0 text-sm font-semibold tabular-nums text-red-600">
                  {person.overdue} overdue
                </span>
              </li>
            ))}
          </ul>
        </AdminCard>
      )}
    </div>
  )
}

/**
 * One person's tasks and goals, for User 360.
 *
 * Read-only: an administrator assigns from the Tasks page, where the whole
 * directory is to hand. A second assignment form buried in a profile section
 * would be a second thing to keep in step for no gain.
 */
export function UserTaskPanel({ tasks, goals, report, isLoading = false }) {
  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="skeleton h-56" />
        <div className="skeleton h-56" />
      </div>
    )
  }

  const open = (tasks ?? []).filter((task) => !task.isComplete)
  const done = (tasks ?? []).filter((task) => task.isComplete)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Assigned" value={report?.tasks?.total ?? 0} icon={ListTodo} />
        <AdminStatCard label="Open" value={report?.tasks?.open ?? 0} />
        <AdminStatCard
          label="Completion"
          value={report?.tasks?.completionRate === null ? '—' : `${report?.tasks?.completionRate ?? 0}%`}
          hint={report?.tasks?.completionRate === null ? 'Nothing assigned yet' : undefined}
        />
        <AdminStatCard
          label="Average to finish"
          value={
            report?.tasks?.averageCompletionHours === null ||
            report?.tasks?.averageCompletionHours === undefined
              ? '—'
              : `${report.tasks.averageCompletionHours}h`
          }
          hint={report?.tasks?.averageCompletionHours === null ? 'Nothing finished yet' : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AdminCard title="Open tasks" description="Most urgent first.">
          {open.length === 0 ? (
            <p className="text-sm text-slate-400">Nothing outstanding.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {open.slice(0, 8).map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-slate-800">{task.title}</span>
                    {task.dueAt && (
                      <span className={`text-xs ${task.isOverdue ? 'text-red-600' : 'text-slate-500'}`}>
                        {task.isOverdue ? 'Overdue — ' : ''}
                        {formatDue(task.dueAt)}
                      </span>
                    )}
                  </span>
                  <TaskStatusPill status={task.status} />
                </li>
              ))}
            </ul>
          )}
        </AdminCard>

        <AdminCard title="Recently completed">
          {done.length === 0 ? (
            <p className="text-sm text-slate-400">Nothing finished yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {done.slice(0, 8).map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0 truncate text-sm text-slate-600">{task.title}</span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {task.completedAt
                      ? new Date(task.completedAt).toLocaleDateString('en-AU', {
                          day: 'numeric',
                          month: 'short',
                        })
                      : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </div>

      <AdminCard
        title="Goals"
        description="Progress is read live from the same measurements the performance section above uses."
      >
        {goals?.goals?.length ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {goals.goals.map((goal) => (
              <GoalBar key={goal.id} goal={goal} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">No goals set for this person.</p>
        )}
      </AdminCard>
    </div>
  )
}

export default TaskWidgets
