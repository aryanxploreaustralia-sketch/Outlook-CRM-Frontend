/**
 * Confirmation for a status change.
 *
 * ## Why suspending asks and activating does not have to
 *
 * Both go through this dialog, but they are not the same act. Activating grants
 * access and is trivially undone. Suspending revokes it *and destroys every
 * session the person holds* — they are signed out wherever they are working, at
 * once. That is exactly right, and it is exactly the sort of thing a user should
 * be told before it happens rather than after.
 *
 * So the dialog states the consequence in the user's terms, names the account so
 * a mis-clicked row is caught here, and puts the destructive verb on a red
 * button. It does not demand a typed confirmation — that is for irreversible
 * acts, and this one is reversed by the button next to it.
 */

import { AlertTriangle, ShieldCheck } from 'lucide-react'

import { AdminModal } from '@/admin/components/AdminModal'
import { Button } from '@/components/ui/Button'

const VARIANTS = {
  activate: {
    Icon: ShieldCheck,
    tone: 'text-emerald-600 bg-emerald-50',
    title: 'Activate this account?',
    confirmLabel: 'Activate',
    confirmVariant: 'primary',
    busyLabel: 'Activating…',
    consequences: [
      'They will be able to sign in with their Google account.',
      'Their first sign-in links their Google identity to this record.',
      'Nothing is sent to them — tell them yourself that they have access.',
    ],
  },
  suspend: {
    Icon: AlertTriangle,
    tone: 'text-red-600 bg-red-50',
    title: 'Suspend this account?',
    confirmLabel: 'Suspend',
    confirmVariant: 'danger',
    busyLabel: 'Suspending…',
    consequences: [
      'They are signed out immediately, everywhere.',
      'They cannot sign in again until an administrator reactivates them.',
      'Nothing is deleted. Their leads, conversations and history are untouched.',
    ],
  },
  /**
   * Deletion, which is a **soft** delete — the wording says so plainly.
   *
   * The account keeps its document and everything that references it; what the
   * person loses is access. Describing it as permanent would be untrue and
   * would stop an administrator doing something reversible.
   */
  delete: {
    Icon: AlertTriangle,
    tone: 'text-red-600 bg-red-50',
    title: 'Delete this account?',
    confirmLabel: 'Delete',
    confirmVariant: 'danger',
    busyLabel: 'Deleting…',
    consequences: [
      'They are signed out immediately and can no longer sign in.',
      'Their leads, conversations, campaigns and audit history are all kept.',
      'The account can be restored later, and their email can be invited again.',
    ],
  },
  restore: {
    Icon: ShieldCheck,
    tone: 'text-emerald-600 bg-emerald-50',
    title: 'Restore this account?',
    confirmLabel: 'Restore',
    confirmVariant: 'primary',
    busyLabel: 'Restoring…',
    consequences: [
      'The account becomes active and can sign in again.',
      'Everything it owned is still attached to it.',
    ],
  },
}

/**
 * @param {{
 *   isOpen: boolean,
 *   action: 'activate' | 'suspend' | 'delete' | 'restore' | null,
 *   user: ?object,
 *   error: ?string,
 *   isBusy: boolean,
 *   onConfirm: () => void,
 *   onClose: () => void,
 * }} props
 */
export function ConfirmStatusDialog({ isOpen, action, user, error, isBusy, onConfirm, onClose }) {
  const config = VARIANTS[action]

  // Guarded rather than assumed: the dialog is mounted with `action: null`
  // between uses, and reading `.title` off undefined would blank the screen.
  if (!config || !user) return null

  const { Icon } = config

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      busy={isBusy}
      size="sm"
      title={config.title}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button
            variant={config.confirmVariant}
            size="sm"
            onClick={onConfirm}
            isLoading={isBusy}
            loadingLabel={config.busyLabel}
          >
            {config.confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3.5">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${config.tone}`} aria-hidden="true">
          <Icon className="size-5" />
        </span>

        <div className="min-w-0">
          {/* The account is named here so a wrong row is caught before the
              action, not discovered afterwards in the directory. */}
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-900">
              {user.displayName ?? user.email}
            </span>
            {user.displayName && user.email ? ` (${user.email})` : ''}
          </p>

          <ul className="mt-3 space-y-1.5">
            {config.consequences.map((line) => (
              <li key={line} className="flex items-start gap-2 text-sm text-slate-600">
                <span
                  className="mt-1.5 size-1 shrink-0 rounded-full bg-slate-400"
                  aria-hidden="true"
                />
                <span className="min-w-0">{line}</span>
              </li>
            ))}
          </ul>

          {error && (
            <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
      </div>
    </AdminModal>
  )
}

export default ConfirmStatusDialog
