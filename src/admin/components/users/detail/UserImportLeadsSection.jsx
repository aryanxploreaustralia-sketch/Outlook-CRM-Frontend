/**
 * Assigning a workbook of enquiries to the user whose profile is open.
 *
 * ## What this does and does not own
 *
 * It owns the steps and the chrome. It owns none of the rules.
 *
 * Reading the workbook, classifying its worksheets, mapping columns, parsing
 * Query Dates, normalising the `Status` column onto the four stages, carrying
 * Remarks across, detecting duplicates by `owner + reference` and writing the
 * leads all happen on the server, in the same `classifyWorkbook` / `analyseSheet`
 * / `importSheet` the CRM importer calls. Nothing is reimplemented here, so a
 * change to any of those rules reaches this screen without being told.
 *
 * The one difference from the CRM importer is the owner: every enquiry is
 * written with `owner = this profile's user`, decided server-side from the id
 * in the URL. The administrator is recorded as `createdBy`.
 *
 * ## The steps
 *
 *   upload → choose sheets → review mapping → preview → result
 *
 * The same five the CRM wizard uses, read from the same `IMPORT_STEPS`
 * constant, because an administrator who has used one should not have to learn
 * the other.
 *
 * ## Why the target user is on screen throughout
 *
 * An administrator who loses track of whose register they are filling will
 * only discover it after two thousand enquiries have landed in the wrong
 * account, and there is no undo for that. The name and address stay visible at
 * every step.
 */

import { useRef, useState } from 'react'
import { FileSpreadsheet, TriangleAlert, Upload, X } from 'lucide-react'

import { AdminCard } from '@/admin/components/AdminCard'
import { PendingSection, UserSection } from '@/admin/components/users/detail/UserDetailPrimitives'
import { importAdminUserLeads } from '@/admin/services/admin.service'
import { inspectWorkbook } from '@/api/services/lead.service'
import { Button } from '@/components/ui/Button'
import { IMPORT_STEPS, LEAD_FIELDS, SHEET_KIND_STYLES } from '@/constants/lead.constants'

/** Human file size. */
function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/** The steps this screen walks, by index into `IMPORT_STEPS`. */
const STEP = Object.freeze({ UPLOAD: 0, SHEETS: 1, MAPPING: 2, PREVIEW: 3, RESULT: 4 })

/**
 * @param {{ user: object }} props
 *   `user` is the profile being viewed. Its `id` is what the server is given;
 *   the name and address are shown so the administrator can see whose register
 *   they are filling.
 */
export function UserImportLeadsSection({ user, canImport, registerRef, onImported }) {
  const [step, setStep] = useState(STEP.UPLOAD)
  const [file, setFile] = useState(null)
  const [inspection, setInspection] = useState(null)
  const [selected, setSelected] = useState([])
  const [mapping, setMapping] = useState(null)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  /** The hidden file input, opened programmatically — see the upload step. */
  const fileInput = useRef(null)

  const reset = () => {
    setStep(STEP.UPLOAD)
    setFile(null)
    setInspection(null)
    setSelected([])
    setMapping(null)
    setPreview(null)
    setResult(null)
    setError(null)
  }

  /**
   * Step 1 → 2. Reads the workbook's structure.
   *
   * Uses the CRM's own inspection endpoint, which parses and classifies without
   * touching the database and without reference to an owner — so it is correct
   * for an administrator inspecting somebody else's file, and needed no
   * server-side addition.
   */
  const handleFile = async (chosen) => {
    if (!chosen) return

    setBusy('Reading the workbook…')
    setError(null)

    try {
      const data = await inspectWorkbook(chosen)
      setFile(chosen)
      setInspection(data)
      // Preselect what the classifier calls a lead register; the admin adjusts.
      setSelected((data.sheets ?? []).filter((s) => s.kind === 'leads').map((s) => s.name))
      setStep(STEP.SHEETS)
    } catch (thrown) {
      setError(thrown?.message ?? 'The workbook could not be read.')
    } finally {
      setBusy(null)
    }
  }

  /** Step 3 → 4. Validates against **this user's** register, writing nothing. */
  const runPreview = async () => {
    setBusy('Checking the rows…')
    setError(null)

    try {
      const data = await importAdminUserLeads(user.id, file, {
        sheets: selected,
        mapping: selected.length === 1 ? mapping : null,
        dryRun: true,
      })
      setPreview(data)
      setStep(STEP.PREVIEW)
    } catch (thrown) {
      setError(thrown?.message ?? 'The rows could not be checked.')
    } finally {
      setBusy(null)
    }
  }

  /** Step 4 → 5. The only call that writes. */
  const runImport = async () => {
    setBusy('Importing…')
    setError(null)

    try {
      const data = await importAdminUserLeads(user.id, file, {
        sheets: selected,
        mapping: selected.length === 1 ? mapping : null,
      })
      setResult(data)
      setStep(STEP.RESULT)

      // Only after the write has been confirmed, and only on success — so the
      // surrounding profile re-reads this person's enquiries rather than
      // leaving a stale list beside a success summary.
      onImported?.()
    } catch (thrown) {
      setError(thrown?.message ?? 'The import failed.')
    } finally {
      setBusy(null)
    }
  }

  const sheets = inspection?.sheets ?? []
  const activeSheet = selected.length === 1 ? sheets.find((s) => s.name === selected[0]) : null
  const effectiveMapping = mapping ?? activeSheet?.mapping ?? []

  return (
    <UserSection
      id="import-leads"
      ref={registerRef('import-leads')}
      title="Import leads"
      description="Assign an Excel workbook to this user. Every enquiry it creates is owned by them."
    >
      {!canImport ? (
        <PendingSection title="You cannot import leads for this user">
          This section needs the “Invite users” permission — the same capability that creates an
          account and stocks it during onboarding.
        </PendingSection>
      ) : user.isDeleted ? (
        /* The server refuses this too; saying so here avoids offering an
           upload that can only end in an error. */
        <PendingSection title="This account has been removed">
          Enquiries cannot be assigned to a deleted account. Restore it first.
        </PendingSection>
      ) : (
    <AdminCard>
      {/* --- Who this is for, at every step ------------------------------- */}
      <div className="mb-4 flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Importing leads for
          </p>
          <p className="truncate text-sm font-semibold text-slate-900">
            {user.displayName ?? user.email}
          </p>
          <p className="truncate text-xs text-slate-500">{user.email}</p>
        </div>
      </div>

      {/* --- Steps -------------------------------------------------------- */}
      <ol className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {IMPORT_STEPS.map((item, index) => (
          <li
            key={item.id}
            className={
              index === step
                ? 'font-semibold text-slate-900'
                : index < step
                  ? 'text-emerald-600'
                  : 'text-slate-400'
            }
          >
            {index + 1}. {item.label}
          </li>
        ))}
      </ol>

      {error && (
        <div role="alert" className="mb-4 flex items-start gap-2.5 rounded-lg bg-red-50 px-3 py-2.5">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden="true" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {busy && <p className="mb-3 text-sm text-slate-500">{busy}</p>}

      {/* --- 1. Upload ----------------------------------------------------
          The input is opened through a ref, exactly as the CRM importer opens
          its own. It is deliberately **not** wrapped in a `<label>`.

          A label moves focus to the control it labels. This control is
          `sr-only` — absolutely positioned, one pixel, clipped — and focusing
          it makes the browser scroll it into view, which scrolls `#admin-main`
          (the admin shell's only scroll container) to an offset with no content
          beneath it. The profile does not crash or unmount; it scrolls away,
          which reads as a blank page the instant the picker opens.

          `.click()` on the ref opens the picker without focusing anything, so
          nothing scrolls. This is why the CRM importer has never shown the
          fault, and copying its pattern is the fix. */}
      {step === STEP.UPLOAD && (
        <div className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center">
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(event) => {
              const chosen = event.target.files?.[0] ?? null
              // Cleared so choosing the same file twice still fires `change`.
              event.target.value = ''
              // `handleFile` returns immediately on null, so cancelling the
              // native picker does nothing at all.
              handleFile(chosen)
            }}
          />

          <Button size="sm" disabled={Boolean(busy)} onClick={() => fileInput.current?.click()}>
            <Upload className="size-4" aria-hidden="true" />
            Choose .xlsx file
          </Button>

          <p className="mt-2 text-xs text-slate-500">
            Every worksheet is read and classified. Nothing is written until you have seen the
            preview.
          </p>
        </div>
      )}

      {file && step !== STEP.UPLOAD && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
          <FileSpreadsheet className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-slate-800">{file.name}</p>
            <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
          </div>
          <button
            type="button"
            onClick={reset}
            disabled={Boolean(busy)}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-50"
            aria-label="Start again"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* --- 2. Choose sheets --------------------------------------------- */}
      {step === STEP.SHEETS && (
        <>
          <ul className="space-y-2">
            {sheets.map((sheet) => {
              const style = SHEET_KIND_STYLES[sheet.kind] ?? SHEET_KIND_STYLES.unknown
              const selectable = sheet.kind === 'leads'

              return (
                <li
                  key={sheet.name}
                  className="flex items-start gap-3 rounded-lg border border-slate-200 px-3 py-2.5"
                >
                  <input
                    type="checkbox"
                    className="mt-1 size-4 shrink-0"
                    disabled={!selectable}
                    checked={selected.includes(sheet.name)}
                    onChange={(event) =>
                      setSelected((previous) =>
                        event.target.checked
                          ? [...previous, sheet.name]
                          : previous.filter((n) => n !== sheet.name),
                      )
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">{sheet.name}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style.className}`}
                      >
                        {style.label}
                      </span>
                      <span className="text-xs tabular-nums text-slate-400">
                        {(sheet.rowCount ?? 0).toLocaleString()} row(s)
                      </span>
                    </div>
                    {/* The classifier's own words — why a sheet is or is not a
                        register. Never hidden, including for skipped tabs. */}
                    {sheet.reason && (
                      <p className="mt-0.5 text-xs text-slate-500">{sheet.reason}</p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={reset}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={selected.length === 0 || Boolean(busy)}
              onClick={() => setStep(STEP.MAPPING)}
            >
              Review mapping
            </Button>
          </div>
        </>
      )}

      {/* --- 3. Review mapping -------------------------------------------- */}
      {step === STEP.MAPPING && (
        <>
          {activeSheet ? (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">Spreadsheet column</th>
                    <th scope="col" className="px-3 py-2 font-medium">CRM field</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {effectiveMapping.map((entry) => (
                    <tr key={entry.index}>
                      <td className="px-3 py-2 text-slate-700">{entry.column || '—'}</td>
                      <td className="px-3 py-2">
                        <select
                          value={entry.field}
                          onChange={(event) =>
                            setMapping(
                              effectiveMapping.map((row) =>
                                row.index === entry.index
                                  ? { ...row, field: event.target.value }
                                  : row,
                              ),
                            )
                          }
                          className="rounded-md border border-slate-200 px-2 py-1 text-sm"
                        >
                          {LEAD_FIELDS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Corrections apply to one sheet's columns and cannot be assumed to
               fit another's, so they are offered only for a single selection.
               Several sheets still import, each with its detected mapping. */
            <p className="text-sm text-slate-500">
              {selected.length} sheets selected. Each is imported with the mapping detected for
              it. Select a single sheet if you need to correct a column.
            </p>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setStep(STEP.SHEETS)}>
              Back
            </Button>
            <Button size="sm" onClick={runPreview} isLoading={Boolean(busy)} loadingLabel="Checking…">
              Preview
            </Button>
          </div>
        </>
      )}

      {/* --- 4. Preview ---------------------------------------------------- */}
      {step === STEP.PREVIEW && preview && (
        <>
          {preview.previews.map((sheet) => (
            <div key={sheet.name} className="mb-4">
              <h4 className="text-sm font-semibold text-slate-900">{sheet.name}</h4>
              <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ['Importable', sheet.counts.valid],
                  ['Already on file', sheet.counts.existing],
                  ['New', sheet.counts.new],
                  ['Invalid', sheet.counts.invalid],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
                    <dt className="text-xs text-slate-500">{label}</dt>
                    <dd className="text-lg font-semibold tabular-nums text-slate-900">
                      {(value ?? 0).toLocaleString()}
                    </dd>
                  </div>
                ))}
              </dl>

              {/* The importer's own issues, verbatim and never summarised away. */}
              {sheet.issues?.length > 0 && (
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
                  {sheet.issues.slice(0, 100).map((issue, index) => (
                    <li key={index}>
                      Row {issue.row}
                      {issue.field ? ` · ${issue.field}` : ''}: {issue.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setStep(STEP.MAPPING)}>
              Back
            </Button>
            <Button size="sm" onClick={runImport} isLoading={Boolean(busy)} loadingLabel="Importing…">
              Import to {user.displayName ?? user.email}
            </Button>
          </div>
        </>
      )}

      {/* --- 5. Result ------------------------------------------------------ */}
      {step === STEP.RESULT && result && (
        <>
          <p className="text-sm text-slate-700">
            Imported into <strong>{result.user.displayName ?? result.user.email}</strong>’s
            register.
          </p>

          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['Imported', result.created],
              ['Updated', result.updated],
              ['Skipped', result.duplicate],
              ['Failed', result.failed + result.invalid],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className="text-lg font-semibold tabular-nums text-slate-900">
                  {(value ?? 0).toLocaleString()}
                </dd>
              </div>
            ))}
          </dl>

          <ul className="mt-3 space-y-1 text-xs text-slate-500">
            {result.sheets.map((sheet) => (
              <li key={sheet.name}>
                <span className="font-medium text-slate-700">{sheet.name}</span>{' '}
                {sheet.imported
                  ? `— ${sheet.created} created, ${sheet.updated} updated`
                  : `— skipped: ${sheet.reason}`}
              </li>
            ))}
          </ul>

          {result.issues?.length > 0 && (
            <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
              {result.issues.slice(0, 100).map((issue, index) => (
                <li key={index}>
                  Row {issue.row}
                  {issue.field ? ` · ${issue.field}` : ''}: {issue.message}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex justify-end">
            <Button size="sm" variant="secondary" onClick={reset}>
              Import another workbook
            </Button>
          </div>
        </>
      )}
    </AdminCard>
      )}
    </UserSection>
  )
}

export default UserImportLeadsSection
