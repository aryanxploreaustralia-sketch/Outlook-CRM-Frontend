/**
 * The handful of things a salesperson opens the CRM to do.
 *
 * Every destination is a route that exists in `ROUTE_PATHS` and is registered in
 * the router, so nothing here can lead to a 404. They are ordered by how often
 * the work actually starts that way: enquiries arrive by workbook far more often
 * than they are typed in one at a time.
 *
 * Composing is listed even when no mailbox is connected. The Compose page opens
 * and explains the problem with its send button disabled, which is a better
 * answer than a hidden button the user cannot find — the same reasoning that
 * kept the mailbox check out of the route guard.
 */

import { Link } from 'react-router-dom'
import {
  FileSpreadsheet,
  ListChecks,
  Mail,
  Megaphone,
  History,
  UserPlus,
} from 'lucide-react'

import { ROUTE_PATHS } from '@/routes/paths'

const ACTIONS = Object.freeze([
  { to: ROUTE_PATHS.LEAD_IMPORT, label: 'Import workbook', Icon: FileSpreadsheet },
  { to: ROUTE_PATHS.LEAD_NEW, label: 'New enquiry', Icon: UserPlus },
  { to: ROUTE_PATHS.COMPOSE, label: 'Compose email', Icon: Mail },
  { to: ROUTE_PATHS.TASKS, label: 'Tasks', Icon: ListChecks },
  { to: ROUTE_PATHS.CAMPAIGNS, label: 'Campaigns', Icon: Megaphone },
  { to: ROUTE_PATHS.MAIL, label: 'Mail history', Icon: History },
])

export function QuickActionsCard() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900">Quick actions</h2>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ACTIONS.map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <Icon className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

export default QuickActionsCard
