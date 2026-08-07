/**
 * Loading screen.
 *
 * Used for whole-route loading — a lazy chunk arriving, or the auth check running
 * before a guarded route can decide anything. For content with a known shape,
 * prefer `SkeletonCard`: it avoids the layout shift a centred spinner causes.
 *
 * `aria-live="polite"` announces the message once, without interrupting whatever
 * a screen-reader user is currently hearing.
 */

import { Spinner } from '@/components/ui/Spinner'

/**
 * @param {{
 *   message?: string,
 *   detail?: string,
 *   fullScreen?: boolean,
 *   className?: string,
 * }} props
 */
export function LoadingScreen({
  message = 'Loading',
  detail,
  fullScreen = false,
  className = '',
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`grid place-items-center px-6 ${
        fullScreen ? 'min-h-svh' : 'min-h-[60vh]'
      } ${className}`}
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <Spinner size="lg" label="" />
        <p className="text-sm font-medium text-slate-700">{message}</p>
        {detail && <p className="max-w-sm text-xs text-slate-500">{detail}</p>}
      </div>
    </div>
  )
}

export default LoadingScreen
