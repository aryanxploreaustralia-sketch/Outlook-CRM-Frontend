/**
 * Tasks — the employee's board, and the manager's (Phase 18).
 *
 * ## One page for both audiences
 *
 * An employee opens it to see what they owe today; an owner or admin opens it
 * to see the team's and to assign more. Two pages would be two lists of the same
 * rows, drifting apart at the first change, so the page renders what the API
 * returns and shows the assignment controls only when the server has said this
 * caller may use them.
 *
 * The gate is `usePermission(USERS_DELETE)` — the same capability the endpoint
 * requires. It hides a control that would answer 403; it is not the check.
 *
 * ## The open task lives in the URL
 *
 * `?task=<id>` opens the drawer, so a task can be linked to — which is what the
 * notification bell does when somebody is assigned work.
 */

import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarClock, CheckCircle2, ListTodo, Plus, Target, TrendingUp } from 'lucide-react'

import { AdminEmptyState } from '@/admin/components/AdminEmptyState'
import { PERMISSIONS } from '@/admin/constants/permissions'
import { usePermission } from '@/admin/hooks/usePermissions'
import {
  createTask,
  deleteTask,
  fetchMyWorkspace,
  fetchTaskReport,
  fetchTasks,
} from '@/api/services/task.service'
import { Card } from '@/components/common/Card'
import { TaskCreateDialog } from '@/components/tasks/TaskCreateDialog'
import { TaskDetailDrawer } from '@/components/tasks/TaskDetailDrawer'
import { GoalBar, TaskRow } from '@/components/tasks/TaskPrimitives'
import { Button } from '@/components/ui/Button'
import { useApiResource } from '@/hooks/useApiResource'

/** A stat, in the CRM's own visual language rather than the console's. */
function Stat({ label, value, hint, icon: Icon, tone = 'slate' }) {
  const tones = {
    slate: 'text-slate-900',
    amber: 'text-amber-600',
    red: 'text-red-600',
    emerald: 'text-emerald-600',
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
        {Icon && <Icon className="size-3.5" aria-hidden="true" />}
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tones[tone]}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  )
}

export function TasksPage() {
  const [params, setParams] = useSearchParams()
  const canManage = usePermission(PERMISSIONS.USERS_DELETE)

  const openTaskId = params.get('task')
  const view = params.get('view') ?? 'mine'

  const [isCreating, setIsCreating] = useState(false)
  const [notice, setNotice] = useState(null)

  // --- The employee's own board --------------------------------------------
  const workspaceLoader = useCallback((options) => fetchMyWorkspace(options), [])
  const workspace = useApiResource(workspaceLoader)

  // --- The list, filtered ---------------------------------------------------
  const status = params.get('status') ?? ''
  const scope = view === 'team' ? 'all' : 'assigned'

  const listLoader = useCallback(
    (options) => fetchTasks({ scope, status: status || undefined, limit: 50 }, options),
    [scope, status],
  )
  const list = useApiResource(listLoader)

  // --- My report ------------------------------------------------------------
  const reportLoader = useCallback((options) => fetchTaskReport({ ...options }), [])
  const report = useApiResource(reportLoader)

  const openTask = useMemo(() => {
    if (!openTaskId) return null

    const pool = [
      ...(list.data?.items ?? []),
      ...(workspace.data?.today ?? []),
      ...(workspace.data?.upcoming ?? []),
      ...(workspace.data?.recentlyCompleted ?? []),
    ]

    return pool.find((task) => task.id === openTaskId) ?? null
  }, [openTaskId, list.data, workspace.data])

  const setOpenTask = (id) => {
    const next = new URLSearchParams(params)
    if (id) next.set('task', id)
    else next.delete('task')
    setParams(next, { replace: true })
  }

  const refreshAll = () => {
    void list.refresh()
    void workspace.refresh()
    void report.refresh()
  }

  const summary = workspace.data?.summary
  const goals = workspace.data?.goals

  return (
    <div className="space-y-6">
      {/* --- Header ------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-[--radius-control] bg-slate-100 p-1">
          {[
            { key: 'mine', label: 'My work' },
            ...(canManage ? [{ key: 'team', label: 'Everyone' }] : []),
            { key: 'goals', label: 'Goals' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                const next = new URLSearchParams(params)
                next.set('view', tab.key)
                next.delete('task')
                setParams(next, { replace: true })
              }}
              className={`rounded-[--radius-control] px-3 py-1.5 text-sm font-medium transition-colors ${
                view === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {canManage && (
          <Button size="sm" onClick={() => setIsCreating(true)}>
            <Plus className="size-3.5" aria-hidden="true" />
            Assign a task
          </Button>
        )}
      </div>

      {notice && (
        <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          {notice}
        </p>
      )}

      {/* --- The counts ---------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Open"
          value={summary?.open ?? '—'}
          hint={summary ? `${summary.total} in total` : undefined}
          icon={ListTodo}
        />
        <Stat
          label="Due today"
          value={summary?.dueToday ?? '—'}
          icon={CalendarClock}
          tone={summary?.dueToday > 0 ? 'amber' : 'slate'}
        />
        <Stat
          label="Overdue"
          value={summary?.overdue ?? '—'}
          icon={CalendarClock}
          tone={summary?.overdue > 0 ? 'red' : 'slate'}
        />
        <Stat
          label="Completed"
          value={summary?.done ?? '—'}
          hint={
            summary?.completionRate === null || summary?.completionRate === undefined
              ? 'No tasks assigned yet'
              : `${summary.completionRate}% of everything assigned`
          }
          icon={CheckCircle2}
          tone="emerald"
        />
      </div>

      {/* --- My work ------------------------------------------------------- */}
      {view === 'mine' && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card
              title="Today"
              description="Due today, already late, or high priority with no deadline."
            >
              {workspace.isInitialLoading ? (
                <div className="skeleton h-32" />
              ) : workspace.data?.today?.length ? (
                <ul className="-mx-3 divide-y divide-slate-100">
                  {workspace.data.today.map((task) => (
                    <TaskRow key={task.id} task={task} onOpen={(t) => setOpenTask(t.id)} />
                  ))}
                </ul>
              ) : (
                <AdminEmptyState
                  title="Nothing due today"
                  description="Anything overdue would appear here too."
                  compact
                />
              )}
            </Card>

            <Card title="Next seven days">
              {workspace.data?.upcoming?.length ? (
                <ul className="-mx-3 divide-y divide-slate-100">
                  {workspace.data.upcoming.map((task) => (
                    <TaskRow key={task.id} task={task} onOpen={(t) => setOpenTask(t.id)} compact />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">Nothing scheduled for the coming week.</p>
              )}
            </Card>

            <Card title="Recently completed">
              {workspace.data?.recentlyCompleted?.length ? (
                <ul className="-mx-3 divide-y divide-slate-100">
                  {workspace.data.recentlyCompleted.map((task) => (
                    <TaskRow key={task.id} task={task} onOpen={(t) => setOpenTask(t.id)} compact />
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">Nothing finished yet.</p>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <Card
              title="Your goals"
              description="Targets set for you, measured against the same figures your performance uses."
            >
              {goals?.items?.length ? (
                <div className="space-y-4">
                  {goals.items.map((goal) => (
                    <GoalBar key={goal.id} goal={goal} />
                  ))}
                </div>
              ) : (
                <AdminEmptyState
                  title="No goals set"
                  description="An owner or administrator sets these."
                  compact
                />
              )}
            </Card>

            <Card title="Your figures" description="Over the last 30 days.">
              <dl className="space-y-2.5">
                {[
                  {
                    label: 'Task completion',
                    value:
                      report.data?.tasks?.completionRate === null ||
                      report.data?.tasks?.completionRate === undefined
                        ? '—'
                        : `${report.data.tasks.completionRate}%`,
                  },
                  {
                    label: 'Goal achievement',
                    value:
                      goals?.achievementRate === null || goals?.achievementRate === undefined
                        ? '—'
                        : `${goals.achievementRate}%`,
                  },
                  {
                    label: 'Average time to finish',
                    value:
                      report.data?.tasks?.averageCompletionHours === null ||
                      report.data?.tasks?.averageCompletionHours === undefined
                        ? '—'
                        : `${report.data.tasks.averageCompletionHours} hours`,
                  },
                ].map((row) => (
                  <div key={row.label} className="flex items-baseline justify-between gap-3">
                    <dt className="text-sm text-slate-500">{row.label}</dt>
                    <dd className="text-sm font-medium tabular-nums text-slate-800">{row.value}</dd>
                  </div>
                ))}
              </dl>

              {/* The trend, as a plain sparkline of daily completions. A chart
                  library for one series on a side panel would be the wrong
                  trade; the shape is the whole message. */}
              {report.data?.trend?.length > 0 && (
                <div className="mt-4 flex h-12 items-end gap-px" aria-hidden="true">
                  {report.data.trend.map((point) => {
                    const peak = Math.max(...report.data.trend.map((entry) => entry.value), 1)

                    return (
                      <span
                        key={point.periodStart}
                        title={`${point.label}: ${point.value}`}
                        className="flex-1 rounded-sm bg-brand-200"
                        style={{ height: `${Math.max((point.value / peak) * 100, 4)}%` }}
                      />
                    )
                  })}
                </div>
              )}
              <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-400">
                <TrendingUp className="size-3" aria-hidden="true" />
                Tasks completed each day, last 30 days
              </p>
            </Card>
          </div>
        </div>
      )}

      {/* --- Everyone ------------------------------------------------------ */}
      {view === 'team' && (
        <Card
          title="Everyone's tasks"
          description="Every open task across the team, most urgent first."
        >
          <div className="mb-3 flex flex-wrap gap-1.5">
            {[
              { value: '', label: 'All' },
              { value: 'todo', label: 'To do' },
              { value: 'in_progress', label: 'In progress' },
              { value: 'done', label: 'Done' },
            ].map((option) => (
              <Button
                key={option.value || 'all'}
                size="sm"
                variant={status === option.value ? 'primary' : 'secondary'}
                onClick={() => {
                  const next = new URLSearchParams(params)
                  if (option.value) next.set('status', option.value)
                  else next.delete('status')
                  setParams(next, { replace: true })
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>

          {list.isInitialLoading ? (
            <div className="skeleton h-64" />
          ) : list.data?.items?.length ? (
            <ul className="-mx-3 divide-y divide-slate-100">
              {list.data.items.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  showAssignee
                  onOpen={(t) => setOpenTask(t.id)}
                />
              ))}
            </ul>
          ) : (
            <AdminEmptyState title="No tasks match" description="Try a different filter." compact />
          )}
        </Card>
      )}

      {/* --- Goals --------------------------------------------------------- */}
      {view === 'goals' && (
        <Card
          title="Goals"
          description="Every target currently set for you. Progress is read live from the same measurements your performance dashboard uses — nothing here is stored separately."
        >
          {goals?.items?.length ? (
            <div className="grid gap-5 sm:grid-cols-2">
              {goals.items.map((goal) => (
                <GoalBar key={goal.id} goal={goal} />
              ))}
            </div>
          ) : (
            <AdminEmptyState
              title="No goals set"
              description="An owner or administrator sets goals against measurements the CRM already takes — emails, replies, campaigns, enquiries, working hours and completed tasks."
              icon={Target}
              compact
            />
          )}
        </Card>
      )}

      {/* --- Overlays ------------------------------------------------------ */}
      <TaskDetailDrawer
        task={openTask}
        isOpen={Boolean(openTask)}
        onClose={() => setOpenTask(null)}
        canManage={canManage}
        onChanged={() => refreshAll()}
        onDelete={async (task) => {
          await deleteTask(task.id)
          setOpenTask(null)
          setNotice('That task was deleted. Its history is retained.')
          refreshAll()
          setTimeout(() => setNotice(null), 6000)
        }}
      />

      <TaskCreateDialog
        isOpen={isCreating}
        onClose={() => setIsCreating(false)}
        onCreate={async (input) => {
          await createTask(input)
          setIsCreating(false)
          setNotice('Task assigned. They have been notified.')
          refreshAll()
          setTimeout(() => setNotice(null), 6000)
        }}
      />
    </div>
  )
}

export default TasksPage
