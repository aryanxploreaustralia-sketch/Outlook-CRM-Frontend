/**
 * Banner shown whenever the server is serving simulated data.
 *
 * Not optional, and deliberately prominent. A demo that looked like a live
 * mailbox would be worse than no demo — someone would draw conclusions from
 * invented messages. The banner states plainly that the data is simulated and
 * why, so the fallback is a visible feature rather than a silent one.
 */

import { FlaskConical } from 'lucide-react'

import { FALLBACK_REASONS } from '@/constants/provider.constants'

/**
 * @param {{ reason?: ?string, className?: string }} props
 */
export function MockModeBanner({ reason, className = '' }) {
  const explanation =
    FALLBACK_REASONS[reason] ??
    'The server is returning simulated data because no live provider is configured.'

  return (
    <div
      role="status"
      className={`flex items-start gap-3 rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 ${className}`}
    >
      <FlaskConical className="mt-0.5 size-4 shrink-0 text-violet-600" aria-hidden="true" />

      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium text-violet-900">Simulated mailbox</p>
        <p className="mt-0.5 text-violet-800">{explanation}</p>
        <p className="mt-1.5 text-xs text-violet-700">
          Every folder, message and sync result below is generated locally. Set{' '}
          <code className="rounded bg-violet-100 px-1 py-0.5 font-mono text-[11px]">
            MICROSOFT_CLIENT_ID
          </code>
          ,{' '}
          <code className="rounded bg-violet-100 px-1 py-0.5 font-mono text-[11px]">
            MICROSOFT_CLIENT_SECRET
          </code>{' '}
          and{' '}
          <code className="rounded bg-violet-100 px-1 py-0.5 font-mono text-[11px]">
            MICROSOFT_TENANT_ID
          </code>{' '}
          in <code className="font-mono text-[11px]">backend/.env</code> to connect a real mailbox.
        </p>
      </div>
    </div>
  )
}

export default MockModeBanner
