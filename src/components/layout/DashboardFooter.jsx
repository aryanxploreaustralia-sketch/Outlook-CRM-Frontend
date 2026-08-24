/**
 * Dashboard footer.
 *
 * Deliberately minimal. A footer inside an application shell is for provenance
 * and build identity, not navigation — the sidebar owns navigation, and
 * duplicating links here would only add noise.
 */

import { env } from '@/config/env'
import { formatTime } from '@/utils/datetime'

/** @param {{ generatedAt?: ?string }} props */
export function DashboardFooter({ generatedAt }) {
  return (
    /*
     * Phase 16.1D: the app background, not `bg-white`.
     *
     * A full-width white bar under a slate-50 page reads as a distinct block —
     * and on a short page, with `mt-auto` holding it at the bottom of the
     * viewport, it framed the empty region above it into something that looked
     * like an unintended white area. On the app background it is provenance
     * text at the foot of the page, which is all it was ever meant to be.
     *
     * `mt-auto` is retained but is now inert in both shells, and deliberately
     * so. Holding the footer at the bottom of a viewport-tall box is what
     * *created* the blank region: on a short page the gap above it is not
     * spacing, it is unexplained emptiness with a rule drawn under it.
     *
     * Neither `<main>` is a flex column any more, so this has no free space to
     * consume and the footer simply follows the content. It is left in place
     * rather than deleted because it is harmless outside a flex column and is
     * the correct behaviour if either shell ever becomes one again.
     */
    <footer className="mt-auto border-t border-slate-200/70 bg-transparent">
      <div className="flex flex-col items-center justify-between gap-1.5 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:px-6">
        <p>
          &copy; {new Date().getFullYear()} {env.appName}
        </p>
        <p className="font-mono text-[11px]">
          {env.mode}
          {generatedAt && ` · data ${formatTime(generatedAt)}`}
        </p>
      </div>
    </footer>
  )
}

export default DashboardFooter
