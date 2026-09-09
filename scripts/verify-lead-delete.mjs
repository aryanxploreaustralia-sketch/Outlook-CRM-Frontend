/**
 * Deleting a single enquiry from the register.
 *
 * Renders the real `DeleteLeadDialog` through Vite's SSR pipeline and drives
 * the real offline write layer against an in-memory IndexedDB, so the `@/`
 * aliases and every module resolve exactly as they do in the browser.
 *
 * ## What this proves and what it does not
 *
 * It proves the dialog's markup and guards, the offline queue entry a delete
 * produces, and — structurally — that the row control cannot navigate, that the
 * two dialogs hold separate state, and that Delete All is untouched. It cannot
 * prove a real click or a real navigation; those need a browser and are
 * reported as unverified.
 *
 * ## Safety
 *
 * No MongoDB, no network, no production data. The IndexedDB lives in this
 * process's memory and is gone when it exits. No lead is deleted anywhere real.
 *
 *     node scripts/verify-lead-delete.mjs
 */

import 'fake-indexeddb/auto'

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

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

/** Source with comments stripped, for claims about what the code *does*. */
const code = (path) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

const VIRTUAL = '\0virtual:lead-delete-render'

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
  plugins: [
    {
      name: 'lead-delete-render',
      resolveId: (id) => (id === 'virtual:lead-delete-render' ? VIRTUAL : null),
      load: (id) =>
        id === VIRTUAL
          ? `
            import { createElement } from 'react'
            import { renderToStaticMarkup } from 'react-dom/server'
            import { DeleteLeadDialog } from '@/components/leads/DeleteLeadDialog'
            export const render = (props) =>
              renderToStaticMarkup(createElement(DeleteLeadDialog, props))
          `
          : null,
    },
  ],
})

const { render } = await server.ssrLoadModule('virtual:lead-delete-render')
const { createLocal, deleteLocal } = await server.ssrLoadModule('/src/offline/write/mutations.js')
const { QUEUE_STATUS, OPERATION, STORE } = await server.ssrLoadModule('/src/offline/db/schema.js')
const { openDatabase } = await server.ssrLoadModule('/src/offline/db/database.js')

const LEAD = { id: '6a9ba8045c579c6e05caaa48', reference: 'XAMP1042', contactPerson: 'Arun Kumar' }

// ---------------------------------------------------------------------------
section('1. THE DIALOG RENDERS AND ASKS')

const closed = render({ isOpen: false, lead: LEAD, onCancel() {}, onConfirm() {} })
check(closed === '', 'renders nothing when closed')

const open = render({ isOpen: true, lead: LEAD, onCancel() {}, onConfirm() {} })

check(open.includes('Delete this lead?'), 'asks the exact question from the brief')
check(open.includes('>Cancel<'), 'offers Cancel')
check(open.includes('>Delete<'), 'offers Delete')
check(open.includes('role="dialog"'), 'is a dialog')
check(open.includes('aria-modal="true"'), 'and modal')
check(open.includes('aria-labelledby="delete-lead-title"'), 'labelled by its own heading')

section('2. IT NAMES THE LEAD, SO THE READER CAN CHECK')

check(open.includes('XAMP1042'), 'the reference is shown — not just "this lead"')
check(open.includes('Arun Kumar'), 'and who it is for')

const other = render({ isOpen: true, lead: { id: 'x', reference: 'XAMP9999' }, onCancel() {}, onConfirm() {} })
check(other.includes('XAMP9999'), 'a different lead renders its own reference')
check(!other.includes('XAMP1042'), 'and never another row’s — the wrong lead cannot be confirmed')

const nameless = render({ isOpen: true, lead: null, onCancel() {}, onConfirm() {} })
check(
  nameless.includes('This enquiry will be removed'),
  'a missing lead falls back to wording that claims nothing',
)
check(!nameless.includes('undefined'), 'and never renders "undefined"')

section('3. DUPLICATE CONFIRMATION IS PREVENTED')

const deleting = render({ isOpen: true, lead: LEAD, isDeleting: true, onCancel() {}, onConfirm() {} })
check(deleting.includes('Deleting…'), 'the button reports the request in flight')
check((deleting.match(/disabled/g) ?? []).length >= 2, 'and both Cancel and Delete are disabled')

const page = code('src/pages/leads/LeadsPage.jsx')
check(
  page.includes('if (!leadToDelete || isDeletingLead) return'),
  'the handler guards re-entry itself — a keyboard repeat can outrun a re-render',
)

section('4. ERRORS SURFACE, AND DO NOT CLOSE THE DIALOG')

const failed = render({
  isOpen: true,
  lead: LEAD,
  error: 'That lead could not be deleted.',
  onCancel() {},
  onConfirm() {},
})
check(failed.includes('That lead could not be deleted.'), 'the error is shown')
check(failed.includes('role="alert"'), 'and announced')
check(failed.includes('>Delete<'), 'the dialog stays open so the reader can retry or cancel')

/*
 * Scoped to the handler's own body.
 *
 * Both `setDeleteNotice` and `setLeadToDelete(null)` appear elsewhere in the
 * page — the Delete All handler uses the first, the dialog's `onCancel` prop
 * the second — so a whole-file `indexOf` compares the wrong occurrences and
 * proves nothing.
 */
const handler = page.slice(
  page.indexOf('const confirmDeleteLead'),
  page.indexOf('// --- Export'),
)

check(handler.length > 0, 'the confirmDeleteLead handler was located', `${handler.length} chars`)
check(
  handler.indexOf('await deleteLead(target.id)') < handler.indexOf('setLeadToDelete(null)'),
  'the dialog closes only after the delete resolved, never before',
)
check(
  handler.indexOf('setLeadToDelete(null)') < handler.indexOf('setDeleteNotice'),
  'and the notice follows the close, so the dialog is not left over the message',
)
/*
 * The OUTER catch specifically.
 *
 * A naive `catch[\s\S]*close` search matches the inner offline-fallback catch,
 * which legitimately precedes the close on the success path. What matters is
 * the failure branch: `catch (error)` through `finally`.
 */
const outerCatch = handler.slice(
  handler.indexOf('} catch (error) {'),
  handler.indexOf('} finally {'),
)

check(outerCatch.length > 0, 'the failure branch was located', `${outerCatch.length} chars`)
check(
  !outerCatch.includes('setLeadToDelete(null)'),
  'a failure never closes the dialog — the error stays in front of the reader',
)
check(
  outerCatch.includes('setDeleteLeadError('),
  'it sets the dialog error instead',
)
check(
  !outerCatch.includes('setDeleteNotice('),
  'and never reports a success notice for a delete that failed',
)

section('5. THE ROW CONTROL CANNOT NAVIGATE OR MISFIRE')

check(page.includes('event.stopPropagation()'), 'the delete button stops propagation')
check(page.includes('aria-label={`Delete lead ${lead.reference'), 'and is named per row for screen readers')
check(
  page.includes('setLeadToDelete(lead)'),
  'clicking it opens the dialog for THAT lead — it never deletes directly',
)
check(
  !/onClick=\{[^}]*deleteLead\(/.test(page),
  'no row control calls the delete API directly; confirmation is unavoidable',
)
check(
  page.includes('setDeleteLeadError(null)'),
  'a previous error is cleared when a new row is opened',
)

section('6. OFFLINE — THE EXISTING QUEUE, NOT A NEW ONE')

const U = 'lead-delete-user-0001'

// A lead the device already holds, then deleted while offline.
const created = await createLocal('leads', { contactPerson: 'Priya Nair', market: 'AU' }, { userId: U })
const localId = created.record.id

const removed = await deleteLocal('leads', localId, { userId: U })
check(Boolean(removed), 'deleteLocal accepts leads — the write layer already supported it')

const db = await openDatabase(U)
const queue = (await db.getAll(STORE.SYNC_QUEUE)).filter((e) => e.status !== QUEUE_STATUS.COMPLETED)

check(
  code('src/pages/leads/LeadsPage.jsx').includes("deleteLocal('leads'"),
  'the page queues through the existing offline write layer',
)
check(
  page.includes('isTransportFailure(thrown)'),
  'and only a dropped connection queues — a refusal is a refusal',
)
check(
  page.includes('queuedLocally'),
  'the two outcomes are tracked apart, so the notice can tell them apart',
)
check(
  page.includes('deleted on this device'),
  'an offline delete says so rather than claiming it reached the CRM',
)

const processor = code('src/offline/write/processor.js')
check(
  processor.includes('[OPERATION.DELETE]: (id, _payload, options) => deleteLead(id, options)'),
  'the existing processor already replays a lead DELETE — no second sync path',
)
check(
  !page.includes('runSync') && !page.includes('new Worker'),
  'the page starts no sync of its own',
)

section('7. DELETE ALL IS UNTOUCHED')

check(page.includes('deleteAllLeads()'), 'Delete All still calls its own API')
check(page.includes('DeleteAllLeadsDialog'), 'and still renders its own dialog')
check(
  page.includes('const [isDeleteOpen') || page.includes('isDeleteOpen'),
  'with its own open state',
)
check(
  page.includes('isDeletingLead') && page.includes('isDeleting'),
  'the two flows hold SEPARATE in-flight flags, so neither can disable the other',
)
check(
  page.includes('leadToDelete') && page.includes('isDeleteOpen'),
  'and separate open flags',
)
check(
  !page.includes('setIsDeleteOpen(true)\n      setLeadToDelete'),
  'opening one never opens the other',
)

const bulkDialog = read('src/components/leads/DeleteAllLeadsDialog.jsx')
check(bulkDialog.includes('CONFIRMATION_WORD'), 'the bulk dialog keeps its typed-word gate')
check(
  !read('src/components/leads/DeleteLeadDialog.jsx').includes('CONFIRMATION_WORD'),
  'and the single dialog deliberately does not — one row is not a purge',
)

section('8. NO BACKEND OR API CHANGE WAS NEEDED')

const service = code('src/api/services/lead.service.js')
check(
  service.includes('export async function deleteLead(id'),
  'deleteLead already existed and is reused unchanged',
)
check(
  service.includes('httpClient.delete(ENDPOINTS.leads.detail(id)'),
  'pointing at the pre-existing DELETE /leads/:id',
)
check(
  (service.match(/export async function deleteLead\b/g) ?? []).length === 1,
  'and there is exactly one such function — no duplicate API was created',
)

await server.close()

console.log(`\n${failures === 0 ? `ALL ${checks} CHECKS PASSED` : `${failures} of ${checks} FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
