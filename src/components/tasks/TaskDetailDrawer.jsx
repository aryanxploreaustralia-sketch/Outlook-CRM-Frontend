/**
 * One task, opened (Phase 18).
 *
 * ## A drawer rather than a route
 *
 * The opposite call to User 360, and for the opposite reason: a task is read in
 * the middle of working through a list, and losing the list to read one item
 * then navigating back is the wrong shape for that. The task id is put in the
 * URL as a query parameter, so the drawer is still linkable and a refresh
 * reopens it.
 *
 * ## What each reader may do comes from the payload
 *
 * `canUpdateStatus` and `canComment` are computed server-side and arrive on the
 * task. Nothing here inspects a role. The endpoints enforce the same rules
 * regardless of what is drawn — hiding a control is a courtesy, not a check.
 */

import { useState } from 'react'
import { Download, Loader2, Paperclip, Send, Trash2 } from 'lucide-react'

import { AdminDrawer } from '@/admin/components/AdminDrawer'
import { TaskProgress, TaskStatusPill } from '@/components/tasks/TaskPrimitives'
import { TASK_PRIORITY_STYLES, formatDue } from '@/components/tasks/taskDisplay'
import { UserAvatar } from '@/components/common/UserAvatar'
import { Button } from '@/components/ui/Button'
import { attachToTask, commentOnTask, taskAttachmentUrl, updateTask } from '@/api/services/task.service'

const STATUSES = [
  { value: 'todo', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'done', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
]

const readableSize = (bytes) =>
  bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

/**
 * @param {{
 *   task: ?object,
 *   isOpen: boolean,
 *   onClose: () => void,
 *   onChanged: (task: object) => void,
 *   canManage?: boolean,
 *   onDelete?: (task: object) => void,
 * }} props
 */
export function TaskDetailDrawer({ task, isOpen, onClose, onChanged, canManage = false, onDelete }) {
  const [comment, setComment] = useState('')
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState(null)

  if (!task) return null

  const priority = TASK_PRIORITY_STYLES[task.priority] ?? TASK_PRIORITY_STYLES.normal

  const run = async (action) => {
    setIsBusy(true)
    setError(null)

    try {
      const updated = await action()
      if (updated) onChanged(updated)
    } catch (caught) {
      setError(caught?.message ?? 'That could not be saved.')
    } finally {
      setIsBusy(false)
    }
  }

  const pickFile = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/pdf,image/png,image/jpeg'

    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) return

      // Fast, kind feedback. The server sniffs the real bytes regardless.
      if (file.size > 10 * 1024 * 1024) {
        setError('That file is larger than 10 MB.')
        return
      }

      void run(() => attachToTask(task.id, file))
    })

    input.click()
  }

  return (
    <AdminDrawer isOpen={isOpen} onClose={onClose} title={task.title} busy={isBusy}>
      <div className="space-y-5">
        {/* --- What it is --------------------------------------------------- */}
        <div className="flex flex-wrap items-center gap-2">
          <TaskStatusPill status={task.status} size="md" />
          <span className={`text-sm font-medium ${priority.className}`}>{priority.label}</span>
          {task.dueAt && (
            <span className={`text-sm ${task.isOverdue ? 'font-medium text-red-600' : 'text-slate-500'}`}>
              Due {formatDue(task.dueAt).toLowerCase()}
            </span>
          )}
        </div>

        {task.description && (
          <p className="whitespace-pre-wrap text-sm text-slate-700">{task.description}</p>
        )}

        <dl className="grid grid-cols-2 gap-4 border-y border-slate-100 py-4">
          <div>
            <dt className="text-xs font-medium text-slate-500">Assigned to</dt>
            <dd className="mt-1 flex items-center gap-2 text-sm text-slate-800">
              <UserAvatar
                name={task.assigneeUser?.displayName}
                email={task.assigneeUser?.email}
                size="xs"
              />
              {task.assigneeUser?.displayName ?? task.assigneeUser?.email ?? 'Unknown'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-slate-500">Assigned by</dt>
            <dd className="mt-1 flex items-center gap-2 text-sm text-slate-800">
              <UserAvatar
                name={task.createdByUser?.displayName}
                email={task.createdByUser?.email}
                size="xs"
              />
              {task.createdByUser?.displayName ?? task.createdByUser?.email ?? 'Unknown'}
            </dd>
          </div>
        </dl>

        {/* --- Progress ----------------------------------------------------- */}
        <div>
          <p className="text-xs font-medium text-slate-500">Progress</p>
          <TaskProgress value={task.progress} className="mt-2" />

          {task.canUpdateStatus && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[0, 25, 50, 75, 100].map((value) => (
                <Button
                  key={value}
                  size="sm"
                  variant={task.progress === value ? 'primary' : 'secondary'}
                  disabled={isBusy}
                  onClick={() => run(() => updateTask(task.id, { progress: value }))}
                >
                  {value}%
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* --- Status ------------------------------------------------------- */}
        {task.canUpdateStatus && (
          <div>
            <p className="text-xs font-medium text-slate-500">Move to</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {STATUSES.filter((status) => status.value !== task.status).map((status) => (
                <Button
                  key={status.value}
                  size="sm"
                  variant="secondary"
                  disabled={isBusy}
                  onClick={() => run(() => updateTask(task.id, { status: status.value }))}
                >
                  {status.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* --- Attachments -------------------------------------------------- */}
        <div>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">
              Attachments {task.attachments.length > 0 && `(${task.attachments.length} of 5)`}
            </p>
            {task.attachments.length < 5 && (
              <Button size="sm" variant="ghost" onClick={pickFile} disabled={isBusy}>
                <Paperclip className="size-3.5" aria-hidden="true" />
                Attach
              </Button>
            )}
          </div>

          {task.attachments.length === 0 ? (
            <p className="mt-1 text-sm text-slate-400">None. PDF, PNG or JPEG, up to 10 MB.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {task.attachments.map((attachment) => (
                <li
                  key={attachment.id}
                  className="flex items-center justify-between gap-3 rounded-(--radius-control) bg-slate-50 px-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-slate-700">{attachment.fileName}</span>
                    <span className="text-xs text-slate-400">{readableSize(attachment.size)}</span>
                  </span>

                  <span className="flex shrink-0 gap-1">
                    <Button
                      as="a"
                      href={taskAttachmentUrl(task.id, attachment.id)}
                      target="_blank"
                      rel="noreferrer"
                      size="sm"
                      variant="ghost"
                    >
                      Open
                    </Button>
                    <Button
                      as="a"
                      href={taskAttachmentUrl(task.id, attachment.id, { download: true })}
                      size="sm"
                      variant="ghost"
                    >
                      <Download className="size-3.5" aria-hidden="true" />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* --- Comments ----------------------------------------------------- */}
        <div>
          <p className="text-xs font-medium text-slate-500">
            Comments {task.comments.length > 0 && `(${task.comments.length})`}
          </p>

          {task.comments.length === 0 ? (
            <p className="mt-1 text-sm text-slate-400">Nothing yet.</p>
          ) : (
            <ul className="mt-2 space-y-3">
              {task.comments.map((entry) => (
                <li key={entry.id} className="flex gap-2.5">
                  <UserAvatar name={entry.authorName} email={entry.authorEmail} size="xs" />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-medium text-slate-800">
                        {entry.isMine ? 'You' : entry.authorName}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(entry.at).toLocaleString('en-AU', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </p>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-600">{entry.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {task.canComment && (
            <form
              className="mt-3 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                if (!comment.trim()) return

                void run(async () => {
                  const updated = await commentOnTask(task.id, comment.trim())
                  setComment('')
                  return updated
                })
              }}
            >
              <input
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Add a comment"
                maxLength={2000}
                className="min-w-0 flex-1 rounded-(--radius-control) border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <Button type="submit" size="sm" disabled={isBusy || !comment.trim()}>
                {isBusy ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="size-3.5" aria-hidden="true" />
                )}
                Send
              </Button>
            </form>
          )}
        </div>

        {error && (
          <p role="alert" className="rounded-(--radius-control) border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        {canManage && (
          <div className="border-t border-slate-100 pt-4">
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => onDelete?.(task)}
              disabled={isBusy}
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Delete this task
            </Button>
          </div>
        )}
      </div>
    </AdminDrawer>
  )
}

export default TaskDetailDrawer
