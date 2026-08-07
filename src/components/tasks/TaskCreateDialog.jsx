/**
 * Assigning a task (Phase 18).
 *
 * ## The people list comes from the directory
 *
 * `GET /admin/users` — the endpoint that already answers "who is in this
 * organization", behind `users.view`. Whoever can reach this dialog holds
 * `users.delete`, and every role that holds it also holds `users.view`, so the
 * list is never empty for somebody who can see the button.
 *
 * ## The only required fields are the two that make it a task
 *
 * A title and a person. Everything else — priority, deadline, description — has
 * a sensible default or no default at all, because a form that demands six
 * fields to write "call the Melbourne agency back" is a form people work around.
 */

import { useCallback, useState } from 'react'

import { AdminModal } from '@/admin/components/AdminModal'
import { AdminSelectField, AdminTextArea, AdminTextField } from '@/admin/components/AdminField'
import { useAdminResource } from '@/admin/hooks/useAdminResource'
import { fetchAdminUsers } from '@/admin/services/admin.service'
import { Button } from '@/components/ui/Button'

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

const EMPTY = { title: '', description: '', assignee: '', priority: 'normal', dueAt: '' }

/**
 * @param {{ isOpen: boolean, onClose: () => void, onCreate: (input: object) => Promise<void> }} props
 */
export function TaskCreateDialog({ isOpen, onClose, onCreate }) {
  const [form, setForm] = useState(EMPTY)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState(null)

  const loader = useCallback((options) => fetchAdminUsers({ ...options, limit: 100 }), [])
  const { data: directory } = useAdminResource(loader, { enabled: isOpen })

  const people = (directory?.items ?? [])
    // Somebody who cannot sign in cannot do the work — the server refuses this
    // too, so offering them would only produce a confusing 400.
    .filter((person) => person.status === 'active')
    .map((person) => ({ value: person.id, label: person.displayName ?? person.email }))

  const set = (key) => (value) => setForm((previous) => ({ ...previous, [key]: value }))

  const submit = async () => {
    setIsBusy(true)
    setError(null)

    try {
      await onCreate({
        title: form.title.trim(),
        description: form.description.trim() || null,
        assignee: form.assignee,
        priority: form.priority,
        // An empty date field must not become `Invalid Date` on the wire.
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
      })

      setForm(EMPTY)
    } catch (caught) {
      setError(caught?.message ?? 'That task could not be assigned.')
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      title="Assign a task"
      busy={isBusy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button
            isLoading={isBusy}
            disabled={!form.title.trim() || !form.assignee}
            onClick={submit}
          >
            Assign
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <AdminTextField
          label="What needs doing"
          value={form.title}
          onChange={set('title')}
          placeholder="Call the Melbourne agency back"
          required
        />

        <AdminSelectField
          label="Who"
          value={form.assignee}
          onChange={set('assignee')}
          options={people}
          placeholder="Choose somebody…"
          required
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <AdminSelectField
            label="Priority"
            value={form.priority}
            onChange={set('priority')}
            options={PRIORITIES}
          />
          <AdminTextField
            label="Due date"
            type="date"
            value={form.dueAt}
            onChange={set('dueAt')}
            hint="Optional. They are told when it passes."
          />
        </div>

        <AdminTextArea
          label="Detail (optional)"
          value={form.description}
          onChange={set('description')}
          rows={3}
          maxLength={5000}
        />

        {error && (
          <p role="alert" className="rounded-[--radius-control] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}
      </div>
    </AdminModal>
  )
}

export default TaskCreateDialog
