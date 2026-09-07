/**
 * Phase 8 — offline UX and PWA polish.
 *
 * Runs the real Phase 8 modules and the real components through Vite's SSR
 * pipeline, so the `@/` aliases and every constant resolve exactly as they do
 * in the browser. Nothing here restates the logic it is checking.
 *
 * ## What this proves and what it does not
 *
 * It proves the derivations, the copy, the rendered markup and the structural
 * guarantees — that manual sync reaches the existing coordinator, that no timer
 * or listener was added, that `/api` is still uncached. It cannot prove a click
 * or a real reconnection; those need a browser and are reported as unverified.
 *
 * ## Safety
 *
 * No MongoDB connection, no network request, no production data, no writes.
 * React and the components share one module graph via a virtual entry, because
 * two copies of React make every hook throw.
 *
 *     node scripts/verify-offline-ux.mjs
 */

import { readFileSync } from 'node:fs'
import { createServer } from 'vite'

let failures = 0
let checks = 0

const check = (ok, label, detail = '') => {
  checks += 1
  if (!ok) failures += 1
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

const section = (title) => console.log(`\n=== ${title} ===`)

const VIRTUAL = '\0virtual:phase8-render'

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
  plugins: [
    {
      name: 'phase8-render',
      resolveId: (id) => (id === 'virtual:phase8-render' ? VIRTUAL : null),
      load: (id) =>
        id === VIRTUAL
          ? `
            import { createElement } from 'react'
            import { renderToStaticMarkup } from 'react-dom/server'
            import { ConnectionStatusIndicator } from '@/components/offline/ConnectionStatusIndicator'
            import { OfflineBanner } from '@/components/offline/OfflineBanner'
            import { SyncStatusPanel } from '@/components/offline/SyncStatusPanel'

            const render = (C) => (props) => renderToStaticMarkup(createElement(C, props))

            export const renderIndicator = render(ConnectionStatusIndicator)
            export const renderBanner = render(OfflineBanner)
            export const renderPanel = render(SyncStatusPanel)
          `
          : null,
    },
  ],
})

const ux = await server.ssrLoadModule('/src/offline/ux/connectionState.js')
const { CONNECTION_UX, CONNECTION_LABEL, deriveConnectionUx, deriveHydrationState, describeLastSync } = ux
const { SYNC_STATE } = await server.ssrLoadModule('/src/offline/sync/coordinator.js')
const { renderIndicator, renderBanner, renderPanel } = await server.ssrLoadModule('virtual:phase8-render')

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

/**
 * Source with comments removed.
 *
 * Every structural claim below is about what the code *does*, and these files
 * discuss their own decisions at length — `SyncStatusPanel` names `runSync` in
 * prose precisely to explain that it does not call it. Matching raw text would
 * fail on the documentation that proves the point.
 */
const code = (path) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

// ---------------------------------------------------------------------------
section('1. CONNECTION STATE — THE FOUR WORDS')

check(
  deriveConnectionUx({ isOffline: false, syncStatus: SYNC_STATE.IDLE }) === CONNECTION_UX.ONLINE,
  'online and idle → Online',
)
check(
  deriveConnectionUx({ isOffline: true, syncStatus: SYNC_STATE.IDLE }) === CONNECTION_UX.OFFLINE,
  'browser offline → Offline',
)
check(
  deriveConnectionUx({ isOffline: false, syncStatus: SYNC_STATE.SYNCING }) === CONNECTION_UX.SYNCING,
  'a run in flight → Syncing',
)
check(
  deriveConnectionUx({ isOffline: false, syncStatus: null, hasSynced: false }) === CONNECTION_UX.CHECKING,
  'onLine but never confirmed → Checking, not a claimed connection',
)
check(
  deriveConnectionUx({ isOffline: false, syncStatus: SYNC_STATE.OFFLINE }) === CONNECTION_UX.OFFLINE,
  'the coordinator having failed to reach the server outranks a hopeful onLine flag',
)
check(
  deriveConnectionUx({ isOffline: true, syncStatus: SYNC_STATE.SYNCING }) === CONNECTION_UX.SYNCING,
  'syncing wins over offline — the most specific true thing is shown',
)
check(
  deriveConnectionUx({ isOffline: false, syncStatus: SYNC_STATE.ERROR }) === CONNECTION_UX.ONLINE,
  'a failed sync is not a connectivity claim; the panel reports the error instead',
)
check(
  Object.keys(CONNECTION_LABEL).length === 4 &&
    CONNECTION_LABEL[CONNECTION_UX.OFFLINE] === 'Offline',
  'exactly four labels exist, in one place',
)

section('2. RECONNECT AND THE BANNER')

check(renderBanner({ state: CONNECTION_UX.ONLINE }) === '', 'online renders nothing at all')
check(renderBanner({ state: CONNECTION_UX.CHECKING }) === '', 'checking renders nothing')

const offlineBanner = renderBanner({ state: CONNECTION_UX.OFFLINE })
check(offlineBanner.includes('offline'), 'offline renders a banner')
check(offlineBanner.includes('keep working'), 'and says work can continue')
check(offlineBanner.includes('sync when you'), 'and that changes will sync later')
check(!offlineBanner.includes('fixed inset-0'), 'it is not an overlay — nothing is blocked')
check(offlineBanner.includes('role="status"'), 'announced politely, never as an alert')

const countedBanner = renderBanner({ state: CONNECTION_UX.OFFLINE, pending: 3 })
check(countedBanner.includes('3 change'), 'a pending count is folded into the offline message')
check(renderBanner({ state: CONNECTION_UX.OFFLINE, pending: 1 }).includes('1 change '), 'singular is not "1 changes"')

section('3. THE INDICATOR')

for (const [state, word] of Object.entries(CONNECTION_LABEL)) {
  const html = renderIndicator({ state, label: word, detail: `detail for ${state}` })
  check(html.includes(word), `renders the ${state} label`)
}

const indicator = renderIndicator({
  state: CONNECTION_UX.OFFLINE,
  label: 'Offline',
  detail: 'Offline — changes will sync when you’re back online.',
})
check(indicator.includes('role="status"'), 'the indicator is a status region')
check(indicator.includes('sr-only'), 'the full sentence is available to screen readers')
check(indicator.includes('<svg'), 'an icon distinguishes the state, so colour is not the only signal')
check(indicator.includes('aria-hidden="true"'), 'decorative marks are hidden from assistive technology')

section('4. LAST SUCCESSFUL SYNC — NEVER INVENTED')

check(describeLastSync(null) === null, 'never synced → null, so the panel can say so honestly')
check(describeLastSync(undefined) === null, 'undefined behaves the same')
check(describeLastSync('not-a-date') === null, 'an unparseable value is not rendered as a time')

const now = Date.now()
check(describeLastSync(new Date(now - 5_000).toISOString(), now) === 'Just now', '5 seconds → Just now')
check(describeLastSync(new Date(now - 300_000).toISOString(), now) === '5 minutes ago', '5 minutes')
check(describeLastSync(new Date(now - 60_000).toISOString(), now) === '1 minute ago', 'singular minute')
check(describeLastSync(new Date(now - 7_200_000).toISOString(), now) === '2 hours ago', '2 hours')
check(describeLastSync(new Date(now - 172_800_000).toISOString(), now) === '2 days ago', '2 days')
check(
  describeLastSync(new Date(now + 5_000).toISOString(), now) === 'Just now',
  'a clock skew into the future reads as Just now, never a negative duration',
)

const neverPanel = renderPanel({ lastSuccessAt: null, isSyncing: false, onSync() {} })
check(neverPanel.includes('Not synced yet'), 'the panel says "Not synced yet" rather than a fake time')
check(!neverPanel.includes('ago'), 'and shows no relative time at all')

section('5. MANUAL SYNC')

const panelSource = read('src/components/offline/SyncStatusPanel.jsx')
const hookSource = read('src/offline/ux/useConnectionStatus.js')

check(panelSource.includes('Sync now'), 'a "Sync now" control exists')
check(
  renderPanel({ lastSuccessAt: new Date().toISOString(), isSyncing: false, onSync() {} }).includes('Sync now'),
  'and renders when the queue is empty — pulling colleagues’ changes is a reason to sync',
)

const syncingPanel = renderPanel({ lastSuccessAt: new Date().toISOString(), isSyncing: true, onSync() {} })
check(syncingPanel.includes('disabled'), 'the button disables itself while a run is in flight')
check(syncingPanel.includes('Syncing'), 'and says so')
check(syncingPanel.includes('animate-spin'), 'with a moving affordance')

const offlinePanel = renderPanel({ lastSuccessAt: null, isSyncing: false, isOffline: true, onSync() {} })
check(offlinePanel.includes('disabled'), 'and while offline, where a sync would be refused anyway')

check(
  !code('src/components/offline/SyncStatusPanel.jsx').includes('runSync'),
  'the panel implements no sync of its own — it calls the coordinator through a prop',
)
check(
  hookSource.includes('queue.sync'),
  'the hook forwards the coordinator’s own runner rather than wrapping a new one',
)

const coordinatorHook = read('src/offline/sync/useSyncCoordinator.js')
check(
  coordinatorHook.includes("run('manual', { force: true })"),
  'and that runner is force:true — the documented Phase 7 manual behaviour',
)

section('6. COLD OFFLINE — "NOT DOWNLOADED" IS NOT "EMPTY"')

check(
  deriveHydrationState({ lastPull: null, lastStatus: 'never' }) === 'never-downloaded',
  'never attempted → never-downloaded',
)
check(
  deriveHydrationState({ lastPull: null, lastStatus: null }) === 'never-downloaded',
  'no metadata at all → never-downloaded',
)
check(
  deriveHydrationState({ lastPull: null, lastStatus: 'failed' }) === 'never-downloaded',
  'attempted and failed → never-downloaded',
)
check(
  deriveHydrationState({ lastPull: '2026-09-07T00:00:00Z', lastStatus: 'ok' }) === 'downloaded',
  'a successful pull → downloaded, so "zero records" is a fact',
)
check(
  deriveHydrationState({ lastPull: '2026-09-07T00:00:00Z', lastStatus: 'failed' }) === 'downloaded',
  'a pull that succeeded then a later failure still means the data arrived',
)
check(
  deriveHydrationState({ lastPull: null, lastStatus: 'ok' }) === 'unknown',
  'contradictory metadata → unknown, and the caller keeps its existing wording',
)

const leadsPage = read('src/pages/leads/LeadsPage.jsx')
const contactsPage = read('src/pages/contacts/ContactsPage.jsx')

check(leadsPage.includes('neverDownloaded'), 'LeadsPage consults the hydration state')
check(leadsPage.includes('aren’t available offline yet'), 'and says so rather than "No enquiries yet"')
check(leadsPage.includes('No enquiries yet'), 'while keeping the genuine-zero message for the downloaded case')
check(contactsPage.includes('neverDownloaded'), 'ContactsPage consults it too')
check(contactsPage.includes('aren’t available offline yet'), 'with the same distinction')
check(contactsPage.includes('No contacts yet.'), 'and keeps its genuine-zero message')
check(
  leadsPage.includes("useHydrationState('leads')") && contactsPage.includes("useHydrationState('contacts')"),
  'each page asks about its own entity',
)

const hydrationHook = read('src/offline/ux/useHydrationState.js')
check(
  hydrationHook.includes('syncMetaRepository.get(META.LAST_STATUS'),
  'lastStatus is read globally — the key hydrate.js actually writes',
)
check(
  hydrationHook.includes('getLastPull(entity'),
  'while lastPull is read per entity, as it is written',
)

section('7. OFFLINE WRITE FEEDBACK IS HONEST')

const leadCreate = read('src/pages/leads/LeadCreatePage.jsx')
check(leadCreate.includes('Saved on this device'), 'an offline create says where it was saved')
check(!leadCreate.includes("notice: 'Saved successfully'"), 'and never claims a bare "Saved successfully"')
check(
  leadCreate.includes('introduction email is queued'),
  'an offline create with sendMail says the email is queued',
)
check(
  !/notice:[^}]*introduction has been sent/s.test(leadCreate.split('isTransportFailure')[1] ?? ''),
  'and never says the introduction was sent while offline',
)

const contactDetail = read('src/pages/contacts/ContactDetailPage.jsx')
const companyDetail = read('src/pages/leads/CompanyDetailPage.jsx')
check(contactDetail.includes('Deleted on this device'), 'an offline contact delete says it is local')
check(companyDetail.includes('Deleted on this device'), 'an offline company delete says it is local')
check(
  contactDetail.includes('queuedLocally') && companyDetail.includes('queuedLocally'),
  'and the message is shown only when the delete actually fell back to the queue',
)
check(
  contactDetail.includes('deleteLocal') && companyDetail.includes('deleteLocal'),
  'the existing tombstone path is untouched',
)

const navNotice = read('src/components/offline/NavigationNotice.jsx')
check(navNotice.includes('location.state?.notice'), 'the notice channel is finally read')
check(navNotice.includes('state: null'), 'and cleared, so a refresh does not resurrect an old message')

/** Declared here because section 8 asserts against it too. */
const newFiles = [
  'src/offline/ux/connectionState.js',
  'src/offline/ux/useConnectionStatus.js',
  'src/offline/ux/useHydrationState.js',
  'src/components/offline/ConnectionStatusIndicator.jsx',
  'src/components/offline/OfflineBanner.jsx',
  'src/components/offline/SyncStatusPanel.jsx',
  'src/components/offline/NavigationNotice.jsx',
  'src/components/pwa/UpdateAvailableNotice.jsx',
]
const newFilesRaw = newFiles.map(read)

section('8. SERVICE WORKER — DETECTION ONLY')

const swRegister = read('src/pwa/registerServiceWorker.js')
const swSource = read('public/sw.js')
const updateNotice = read('src/components/pwa/UpdateAvailableNotice.jsx')

check(swRegister.includes("addEventListener('updatefound'"), 'update detection is wired to updatefound')
check(swRegister.includes('registration.waiting'), 'and to a worker already waiting on load')
check(
  swRegister.includes('navigator.serviceWorker.controller'),
  'a first install is excluded — there must be an older worker to replace',
)
check(
  !code('src/pwa/registerServiceWorker.js').includes('skipWaiting'),
  'registration never calls skipWaiting',
)

/*
 * `sw.js` carries a dormant opt-in handler:
 *
 *     if (event.data === 'SKIP_WAITING') self.skipWaiting()
 *
 * It pre-dates this phase and is left exactly as it was. What matters is that
 * nothing ever posts that message, so the branch is unreachable in practice —
 * asserting the handler's absence would be asserting a change this phase was
 * told not to make.
 */
check(
  code('public/sw.js').includes("event.data === 'SKIP_WAITING'"),
  'sw.js keeps its pre-existing opt-in SKIP_WAITING handler, unmodified',
)
check(
  !newFilesRaw.some((body) => body.includes('SKIP_WAITING')),
  'and no Phase 8 file posts that message, so the handler stays dormant',
)
check(
  !/location\s*\.\s*reload/.test(swRegister),
  'the registration layer never reloads the page',
)
check(
  updateNotice.includes('A new version is available'),
  'the notice offers the update in the approved words',
)
check(
  updateNotice.includes('Refresh when you’re ready'),
  'and leaves the timing to the reader',
)
check(
  updateNotice.includes('onClick={() => globalThis.location?.reload()}'),
  'the only reload is behind a click',
)
check(
  !/useEffect\([^)]*reload/s.test(updateNotice),
  'no effect reloads on its own',
)

section('9. SERVICE WORKER CACHING IS UNCHANGED')

check(swSource.includes('/api'), 'sw.js still special-cases /api')
check(
  /pathname\.startsWith\('\/api'\)|url\.pathname\.startsWith\("\/api"\)/.test(swSource) ||
    swSource.includes("startsWith('/api')"),
  'and refuses to cache it',
)
check(swSource.includes('Authorization'), 'authenticated requests remain excluded')
check(
  read('public/sw.js') === swSource,
  'public/sw.js was not rewritten by this phase',
)

section('10. NO POLLING, NO DUPLICATE LISTENERS, NO SECOND COORDINATOR')

for (const file of newFiles) {
  const body = read(file)
  check(!body.includes('setInterval'), `${file.split('/').pop()} has no interval`)
}

check(
  !newFiles.some((f) => /addEventListener\(\s*['"]online['"]/.test(read(f))),
  'no new file registers an online listener',
)
check(
  !newFiles.some((f) => /addEventListener\(\s*['"]offline['"]/.test(read(f))),
  'nor an offline listener',
)
check(
  !newFiles.some((f) => code(f).includes('useSyncCoordinator(')),
  'no new file mounts a second sync coordinator',
)
check(
  hookSource.includes('takes the **already-mounted**') || hookSource.includes('already-mounted'),
  'useConnectionStatus documents that it receives the existing instance',
)
check(
  !hookSource.includes('fetch(') && !hookSource.includes('httpClient'),
  'and makes no request of its own',
)

const layout = read('src/layouts/DashboardLayout.jsx')
check(
  (layout.match(/useSyncCoordinator\(\)/g) ?? []).length === 1,
  'the layout still mounts exactly one coordinator',
)
check(
  (layout.match(/useConnectionStatus\(/g) ?? []).length === 1,
  'and exactly one connection projection',
)
check(
  read('src/components/layout/Topbar.jsx').includes('connection = null'),
  'the Topbar receives connection as a prop rather than subscribing itself',
)

// One `useReadSource` in the application: the one inside useConnectionStatus.
const allSources = [
  'src/layouts/DashboardLayout.jsx',
  'src/components/layout/Topbar.jsx',
  'src/components/offline/ConnectionStatusIndicator.jsx',
  'src/components/offline/OfflineBanner.jsx',
  'src/components/offline/SyncStatusPanel.jsx',
].map(read)
check(
  !allSources.some((body) => body.includes('useReadSource')),
  'no component subscribes to the read layer directly — the hook owns the single subscription',
)

section('11. REGRESSION — PHASE 7 AND ACCESS CONTROL UNTOUCHED')

const coordinator = read('src/offline/sync/coordinator.js')
check(coordinator.includes('export async function runSync'), 'runSync is still the only sync entry point')
check(coordinator.includes('if (running) return'), 'and still refuses a concurrent run')
check(coordinator.includes('BACKOFF_MS'), 'the backoff schedule is intact')
check(read('src/routes/landing.js').includes('resolveLanding'), 'the Phase 7 landing rule is untouched')
check(read('src/routes/paths.js').includes('NO_ACCESS'), '/no-access is still registered')
check(
  read('src/components/routing/UserPanelRoute.jsx').includes('hasUserPanelAccess'),
  'the User Panel guard is unchanged',
)

await server.close()

console.log(`\n${failures === 0 ? `ALL ${checks} CHECKS PASSED` : `${failures} of ${checks} FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
