/**
 * Tasks and goals, inside User 360 (Phase 18).
 *
 * ## Three requests, one section
 *
 * The tasks, the goals and the report answer different questions and live in
 * different collections; folding them into one endpoint would produce a
 * response that no other screen wants all of. They are requested together and
 * only once the section has been reached.
 *
 * ## Read-only
 *
 * Assignment happens on the Tasks page, where the whole directory is to hand
 * and the manager is already thinking about who should do what. A second
 * assignment form buried in a profile section would be a second thing to keep
 * in step for no gain.
 */

import { useCallback } from 'react'

import { AdminErrorState } from '@/admin/components/AdminErrorState'
import { UserTaskPanel } from '@/admin/components/performance/TaskWidgets'
import { UserSection } from '@/admin/components/users/detail/UserDetailPrimitives'
import { useAdminResource } from '@/admin/hooks/useAdminResource'
import { fetchGoalSummary, fetchTaskReport, fetchTasks } from '@/api/services/task.service'

/**
 * @param {{ user: object, registerRef: (id: string) => object, enabled?: boolean }} props
 */
export function UserTasksSection({ user, registerRef, enabled = true }) {
  const tasksLoader = useCallback(
    (options) => fetchTasks({ assignee: user.id, scope: 'all', limit: 50 }, options),
    [user.id],
  )
  const tasks = useAdminResource(tasksLoader, { deps: [user.id], enabled })

  const goalsLoader = useCallback((options) => fetchGoalSummary({ user: user.id, ...options }), [user.id])
  const goals = useAdminResource(goalsLoader, { deps: [user.id], enabled })

  const reportLoader = useCallback(
    (options) => fetchTaskReport({ user: user.id, ...options }),
    [user.id],
  )
  const report = useAdminResource(reportLoader, { deps: [user.id], enabled })

  const error = tasks.error ?? goals.error ?? report.error

  return (
    <UserSection
      id="tasks"
      ref={registerRef('tasks')}
      title="Tasks and goals"
      description="Work assigned to this person, and the targets set against measurements the CRM already takes."
    >
      {error ? (
        <AdminErrorState
          error={error}
          onRetry={() => {
            void tasks.refresh()
            void goals.refresh()
            void report.refresh()
          }}
          compact
        />
      ) : (
        <UserTaskPanel
          tasks={tasks.data?.items ?? []}
          goals={goals.data}
          report={report.data}
          isLoading={tasks.isLoading || goals.isLoading || report.isLoading}
        />
      )}
    </UserSection>
  )
}

export default UserTasksSection
