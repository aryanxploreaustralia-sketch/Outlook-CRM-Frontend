/**
 * Animates a number towards its target.
 *
 * ## Why a counter animates at all
 *
 * Not decoration. A dashboard that fills in from zero tells the reader *which
 * figures just changed* when they return to a page — the ones that move are the
 * ones that reloaded. A static swap gives no such signal.
 *
 * ## Why it is written by hand
 *
 * A spring library is 12 KB to interpolate one number. `requestAnimationFrame`
 * with an easing function is fifteen lines and has no dependency to keep
 * current.
 *
 * ## What it refuses to animate
 *
 * - **`null` and `undefined`.** A figure the server could not read must render
 *   as a dash immediately. Counting up to zero would state that the value *is*
 *   zero, which is the one thing an unreadable metric must not claim.
 * - **Anything under the threshold.** Animating 0 → 3 is a flicker, not motion.
 * - **A reduced-motion preference.** Checked here rather than left to the
 *   global CSS override, because this is JavaScript setting text content and
 *   the stylesheet cannot reach it.
 */

import { useEffect, useRef, useState } from 'react'

/** Below this, the animation is imperceptible and reads as a glitch. */
const MIN_ANIMATED = 8

/** Matches `--duration-slow`. Long enough to register, short enough to ignore. */
const DURATION_MS = 700

/** Decelerating curve, the same shape as `--ease-out-quint`. */
const easeOutQuint = (t) => 1 - (1 - t) ** 5

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  )
}

/**
 * @param {?number} target
 * @param {{ enabled?: boolean }} [options]
 * @returns {?number} The current value, or the target unchanged when not animating.
 */
export function useCountUp(target, { enabled = true } = {}) {
  const numeric = typeof target === 'number' && Number.isFinite(target) ? target : null

  const [value, setValue] = useState(numeric)
  const frameRef = useRef(0)
  const fromRef = useRef(numeric ?? 0)

  useEffect(() => {
    // Not a number: show it as it is, immediately. Nothing to animate towards.
    if (numeric === null) {
      setValue(null)
      return undefined
    }

    const from = fromRef.current ?? 0
    const distance = Math.abs(numeric - from)

    if (!enabled || prefersReducedMotion() || distance < MIN_ANIMATED) {
      fromRef.current = numeric
      setValue(numeric)
      return undefined
    }

    const start = performance.now()

    const step = (now) => {
      const progress = Math.min((now - start) / DURATION_MS, 1)
      const eased = easeOutQuint(progress)

      // Rounded on the way, so the reader never sees a fractional count.
      setValue(Math.round(from + (numeric - from) * eased))

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step)
      } else {
        fromRef.current = numeric
      }
    }

    frameRef.current = requestAnimationFrame(step)

    // Cancelled on unmount and on a new target, so a superseded animation
    // cannot keep writing over the newer one.
    return () => cancelAnimationFrame(frameRef.current)
  }, [numeric, enabled])

  return value
}

export default useCountUp
