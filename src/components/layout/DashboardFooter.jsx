/**
 * Dashboard footer.
 *
 * Deliberately minimal. A footer inside an application shell is for provenance
 * and build identity, not navigation — the sidebar owns navigation, and
 * duplicating links here would only add noise.
 */

import { env } from '@/config/env'

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
     * `mt-auto` stays: it is now the *only* thing deciding where the footer
     * sits, so a short page keeps it at the bottom and a long one lets it
     * follow the content.
     */
    <footer className="mt-auto border-t border-slate-200/70 bg-transparent">
      <div className="flex flex-col items-center justify-between gap-1.5 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:px-6">
        <p>
          &copy; {new Date().getFullYear()} {env.appName}
        </p>
        <p className="font-mono text-[11px]">
          {env.mode}
          {generatedAt && ` · data ${new Date(generatedAt).toLocaleTimeString()}`}
        </p>
      </div>
    </footer>
  )
}

export default DashboardFooter
