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
 *
 * ## The second line is a label, not data
 *
 * Each action carries a short description. It is fixed interface copy sitting
 * beside the title, the way the sidebar's own items carry one — nothing here
 * reads a value, and the card makes no request.
 */

import { Link } from 'react-router-dom'
import {
  FileSpreadsheet,
  Mail,
  Megaphone,
  History,
  UserPlus,
} from 'lucide-react'

import { ROUTE_PATHS } from '@/routes/paths'

const ACTIONS = Object.freeze([
  {
    to: ROUTE_PATHS.LEAD_IMPORT,
    label: 'Import workbook',
    description: 'Bring in a spreadsheet of enquiries',
    Icon: FileSpreadsheet,
  },
  {
    to: ROUTE_PATHS.LEAD_NEW,
    label: 'New enquiry',
    description: 'Record one enquiry by hand',
    Icon: UserPlus,
  },
  {
    to: ROUTE_PATHS.COMPOSE,
    label: 'Compose email',
    description: 'Write to a customer',
    Icon: Mail,
  },
  {
    to: ROUTE_PATHS.CAMPAIGNS,
    label: 'Campaigns',
    description: 'Reach many contacts at once',
    Icon: Megaphone,
  },
  {
    to: ROUTE_PATHS.MAIL,
    label: 'Mail history',
    description: 'Everything this CRM has sent',
    Icon: History,
  },
])

export function QuickActionsCard() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900">Quick actions</h2>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {ACTIONS.map(({ to, label, description, Icon }) => (
          <Link
            key={to}
            to={to}
            /*
             * `items-start` and a fixed icon tile: the descriptions wrap to two
             * lines at narrow widths, and centring would leave the icons
             * drifting down the card as they did.
             */
            className="group flex items-start gap-3 rounded-lg border border-slate-200 p-3 transition-colors hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors group-hover:bg-white group-hover:text-brand-600">
              <Icon className="size-4" aria-hidden="true" />
            </span>

            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-slate-800">{label}</span>
              <span className="mt-0.5 block text-xs leading-snug text-slate-500">
                {description}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}

export default QuickActionsCard
