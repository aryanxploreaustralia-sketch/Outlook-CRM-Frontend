/**
 * Application router.
 *
 * Uses the data-router API (`createBrowserRouter`) for route-level error
 * boundaries and forward compatibility with loaders and actions.
 *
 * **Code splitting.** Every page is loaded through React Router's `lazy`, so a
 * visitor to the login page never downloads the dashboard bundle. `lazy` is used
 * rather than `React.lazy` because the router awaits the module during its own
 * navigation transition, which avoids the Suspense fallback flashing on every
 * route change.
 *
 * **Structure.** Two shells coexist deliberately:
 *   - `RootLayout` carries the remaining public pages (`/system`, the 404);
 *   - `DashboardLayout` is the authenticated shell every module reuses.
 *
 * `/` belongs to neither. It renders `RootRedirect`, which reads the session and
 * forwards to `/login` or `/dashboard` — the CRM has a front door, not a
 * landing page.
 *
 * Route titles live in `handle`, so `DashboardLayout` can read them via
 * `useMatches` and no page has to pass its title upward.
 */

import { createBrowserRouter, Navigate } from 'react-router-dom'

import { adminRoute } from '@/admin/routes/adminRoutes'
import { ProtectedRoute } from '@/components/routing/ProtectedRoute'
import { RootRedirect } from '@/components/routing/RootRedirect'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { RootLayout } from '@/layouts/RootLayout'
import { ErrorPage } from '@/pages/ErrorPage'
import { ROUTE_PATHS } from '@/routes/paths'

export const router = createBrowserRouter([
  // --- Public: sign-in ----------------------------------------------------
  {
    path: ROUTE_PATHS.LOGIN,
    lazy: async () => {
      const { LoginPage } = await import('@/pages/LoginPage')
      return { Component: LoginPage }
    },
    errorElement: <ErrorPage />,
  },

  // --- Authenticated application shell ------------------------------------
  {
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    errorElement: <ErrorPage />,
    children: [
      {
        path: ROUTE_PATHS.DASHBOARD,
        handle: { title: 'Dashboard', subtitle: 'Your enquiries, mailbox and platform' },
        lazy: async () => {
          const { DashboardPage } = await import('@/pages/DashboardPage')
          return { Component: DashboardPage }
        },
      },
      {
        path: ROUTE_PATHS.ACCOUNT,
        handle: { title: 'Account', subtitle: 'Your connected Microsoft account' },
        lazy: async () => {
          const { AccountPage } = await import('@/pages/AccountPage')
          return { Component: AccountPage }
        },
      },
      // Registered before `/mail` so the more specific path wins — React Router
      // ranks by specificity, but keeping them ordered makes the intent explicit.
      {
        path: ROUTE_PATHS.COMPOSE,
        handle: { title: 'Compose', subtitle: 'Send a message through Outlook' },
        lazy: async () => {
          const { ComposePage } = await import('@/pages/ComposePage')
          return { Component: ComposePage }
        },
      },
      {
        path: ROUTE_PATHS.MAIL,
        handle: { title: 'Mail', subtitle: 'Everything this CRM has sent' },
        lazy: async () => {
          const { MailHistoryPage } = await import('@/pages/MailHistoryPage')
          return { Component: MailHistoryPage }
        },
      },

      // --- Phase 5: provider integration ---------------------------------
      // The two sub-paths are declared before the index path for readability;
      // React Router ranks by specificity, so ordering does not affect matching.
      {
        path: ROUTE_PATHS.PROVIDER_FOLDERS,
        handle: { title: 'Folders', subtitle: 'Mailbox folders and their mapping' },
        lazy: async () => {
          const { FoldersPage } = await import('@/pages/provider/FoldersPage')
          return { Component: FoldersPage }
        },
      },
      {
        path: ROUTE_PATHS.PROVIDER_HISTORY,
        handle: { title: 'Sync history', subtitle: 'Every synchronisation run' },
        lazy: async () => {
          const { SyncHistoryPage } = await import('@/pages/provider/SyncHistoryPage')
          return { Component: SyncHistoryPage }
        },
      },
      {
        path: ROUTE_PATHS.PROVIDER,
        handle: { title: 'Provider', subtitle: 'Connection and mailbox synchronisation' },
        lazy: async () => {
          const { ProviderPage } = await import('@/pages/provider/ProviderPage')
          return { Component: ProviderPage }
        },
      },

      // --- Phase 6: contacts ---------------------------------------------
      // Literal sub-paths precede `/contacts/:id`, so "new", "groups" and
      // "import" are not captured as contact ids.
      {
        path: ROUTE_PATHS.CONTACT_NEW,
        handle: { title: 'New contact', subtitle: 'Add someone to your address book' },
        lazy: async () => {
          const { ContactEditPage } = await import('@/pages/contacts/ContactEditPage')
          return { Component: ContactEditPage }
        },
      },
      {
        path: ROUTE_PATHS.CONTACT_GROUPS,
        handle: { title: 'Groups', subtitle: 'Organise contacts into named lists' },
        lazy: async () => {
          const { ContactGroupsPage } = await import('@/pages/contacts/ContactGroupsPage')
          return { Component: ContactGroupsPage }
        },
      },
      {
        path: ROUTE_PATHS.CONTACT_IMPORT,
        handle: { title: 'Import contacts', subtitle: 'CSV, Excel, vCard or JSON' },
        lazy: async () => {
          const { ContactImportPage } = await import('@/pages/contacts/ContactImportPage')
          return { Component: ContactImportPage }
        },
      },
      {
        path: ROUTE_PATHS.CONTACT_EDIT,
        handle: { title: 'Edit contact', subtitle: 'Update contact details' },
        lazy: async () => {
          const { ContactEditPage } = await import('@/pages/contacts/ContactEditPage')
          return { Component: ContactEditPage }
        },
      },
      {
        path: ROUTE_PATHS.CONTACT_DETAIL,
        handle: { title: 'Contact', subtitle: 'Contact details' },
        lazy: async () => {
          const { ContactDetailPage } = await import('@/pages/contacts/ContactDetailPage')
          return { Component: ContactDetailPage }
        },
      },
      {
        path: ROUTE_PATHS.CONTACTS,
        handle: { title: 'Contacts', subtitle: 'Your address book' },
        lazy: async () => {
          const { ContactsPage } = await import('@/pages/contacts/ContactsPage')
          return { Component: ContactsPage }
        },
      },

      // Literal campaign paths before `/campaigns/:id`, so "new", "templates"
      // and "analytics" are never mistaken for campaign ids.
      {
        path: ROUTE_PATHS.CAMPAIGN_NEW,
        handle: { title: 'New campaign', subtitle: 'Build and launch a bulk send' },
        lazy: async () => {
          const { CampaignBuilderPage } = await import('@/pages/campaigns/CampaignBuilderPage')
          return { Component: CampaignBuilderPage }
        },
      },
      {
        path: ROUTE_PATHS.CAMPAIGN_TEMPLATES,
        handle: { title: 'Templates', subtitle: 'Reusable messages with personalisation' },
        lazy: async () => {
          const { CampaignTemplatesPage } = await import('@/pages/campaigns/CampaignTemplatesPage')
          return { Component: CampaignTemplatesPage }
        },
      },
      {
        path: ROUTE_PATHS.CAMPAIGN_ANALYTICS,
        handle: { title: 'Campaign analytics', subtitle: 'Delivery, replies and template performance' },
        lazy: async () => {
          const { CampaignAnalyticsPage } = await import('@/pages/campaigns/CampaignAnalyticsPage')
          return { Component: CampaignAnalyticsPage }
        },
      },
      {
        path: ROUTE_PATHS.CAMPAIGN_DETAIL,
        handle: { title: 'Campaign', subtitle: 'Live progress and recipients' },
        lazy: async () => {
          const { CampaignDetailPage } = await import('@/pages/campaigns/CampaignDetailPage')
          return { Component: CampaignDetailPage }
        },
      },
      {
        path: ROUTE_PATHS.CAMPAIGNS,
        handle: { title: 'Campaigns', subtitle: 'Bulk outreach' },
        lazy: async () => {
          const { CampaignsPage } = await import('@/pages/campaigns/CampaignsPage')
          return { Component: CampaignsPage }
        },
      },

      // Email templates. "new" is registered before `/templates/:id` so it is
      // never mistaken for a template id.
      {
        path: ROUTE_PATHS.TEMPLATE_NEW,
        handle: { title: 'New template', subtitle: 'Write the message new enquiries receive' },
        lazy: async () => {
          const { TemplateEditorPage } = await import('@/pages/templates/TemplateEditorPage')
          return { Component: TemplateEditorPage }
        },
      },
      {
        path: ROUTE_PATHS.TEMPLATE_EDIT,
        handle: { title: 'Edit template', subtitle: 'Live preview against a real enquiry' },
        lazy: async () => {
          const { TemplateEditorPage } = await import('@/pages/templates/TemplateEditorPage')
          return { Component: TemplateEditorPage }
        },
      },
      {
        path: ROUTE_PATHS.TEMPLATES,
        handle: { title: 'Email templates', subtitle: 'What every new enquiry receives' },
        lazy: async () => {
          const { TemplatesPage } = await import('@/pages/templates/TemplatesPage')
          return { Component: TemplatesPage }
        },
      },

      // Literal lead paths before `/leads/:id`, so "pipeline" and "import" are
      // never mistaken for enquiry ids.
      {
        path: ROUTE_PATHS.LEAD_PIPELINE,
        handle: { title: 'Pipeline', subtitle: 'Enquiries by stage' },
        lazy: async () => {
          const { LeadPipelinePage } = await import('@/pages/leads/LeadPipelinePage')
          return { Component: LeadPipelinePage }
        },
      },
      {
        path: ROUTE_PATHS.LEAD_IMPORT,
        handle: { title: 'Import workbook', subtitle: 'Turn the sales sheet into leads' },
        lazy: async () => {
          const { LeadImportPage } = await import('@/pages/leads/LeadImportPage')
          return { Component: LeadImportPage }
        },
      },
      {
        // Registered before `LEAD_DETAIL` so "new" is never matched as an id.
        path: ROUTE_PATHS.LEAD_NEW,
        handle: { title: 'New enquiry', subtitle: 'Create a lead by hand' },
        lazy: async () => {
          const { LeadCreatePage } = await import('@/pages/leads/LeadCreatePage')
          return { Component: LeadCreatePage }
        },
      },
      {
        path: ROUTE_PATHS.LEAD_DETAIL,
        handle: { title: 'Enquiry', subtitle: 'Quotation detail' },
        lazy: async () => {
          const { LeadDetailPage } = await import('@/pages/leads/LeadDetailPage')
          return { Component: LeadDetailPage }
        },
      },
      // --- Phase 18: tasks and goals --------------------------------------
      {
        path: ROUTE_PATHS.TASKS,
        handle: { title: 'Tasks', subtitle: 'Assigned work and the goals set against it' },
        lazy: async () => {
          const { TasksPage } = await import('@/pages/TasksPage')
          return { Component: TasksPage }
        },
      },
      {
        path: ROUTE_PATHS.LEADS,
        handle: { title: 'Leads', subtitle: 'Every quotation enquiry' },
        lazy: async () => {
          const { LeadsPage } = await import('@/pages/leads/LeadsPage')
          return { Component: LeadsPage }
        },
      },
      {
        path: ROUTE_PATHS.COMPANY_DETAIL,
        handle: { title: 'Company', subtitle: 'Partner detail' },
        lazy: async () => {
          const { CompanyDetailPage } = await import('@/pages/leads/CompanyDetailPage')
          return { Component: CompanyDetailPage }
        },
      },
      {
        path: ROUTE_PATHS.COMPANIES,
        handle: { title: 'Companies', subtitle: 'Travel agencies and corporate clients' },
        lazy: async () => {
          const { CompaniesPage } = await import('@/pages/leads/CompaniesPage')
          return { Component: CompaniesPage }
        },
      },

      // --- Phase H3: workspace settings -----------------------------------
      {
        path: ROUTE_PATHS.SETTINGS,
        handle: { title: 'Settings', subtitle: 'The morning run and workspace automation' },
        lazy: async () => {
          const { SettingsPage } = await import('@/pages/SettingsPage')
          return { Component: SettingsPage }
        },
      },
    ],
  },

  // --- Phase 14.1: Enterprise Admin Platform ------------------------------
  // One entry, and the entire admin surface hangs off it. The branch is defined
  // in `@/admin/routes/adminRoutes` and is a sibling of the CRM shell rather
  // than a child of it: the two use different chrome, and nesting would mean
  // every admin page rendered inside the CRM sidebar.
  //
  // Additive by construction — no route above or below is modified, and
  // removing this line removes the module. `/admin` does not collide with any
  // existing path, and React Router ranks its concrete children above the `*`
  // catch-all nested under `/`.
  adminRoute,

  // --- Public: the front door ---------------------------------------------
  //
  // `/` resolves to the login page or the dashboard depending on the session —
  // see `RootRedirect`. It is declared outside `RootLayout` because it renders
  // no page of its own: wrapping a redirect in the public header and footer
  // would paint chrome for an instant before navigating away.
  {
    path: ROUTE_PATHS.ROOT,
    element: <RootRedirect />,
    errorElement: <ErrorPage />,
  },

  // --- Public: remaining unauthenticated pages ----------------------------
  {
    element: <RootLayout />,
    errorElement: <ErrorPage />,
    children: [
      {
        path: ROUTE_PATHS.SYSTEM,
        lazy: async () => {
          const { SystemPage } = await import('@/pages/SystemPage')
          return { Component: SystemPage }
        },
      },
      // Legacy path from Phase 2, when /account was the sign-in page. Redirected
      // rather than removed so an existing bookmark still resolves.
      { path: 'signin', element: <Navigate to={ROUTE_PATHS.LOGIN} replace /> },
      {
        path: ROUTE_PATHS.NOT_FOUND,
        lazy: async () => {
          const { NotFoundPage } = await import('@/pages/NotFoundPage')
          return { Component: NotFoundPage }
        },
      },
    ],
  },
])

export default router
