/**
 * The workbook import wizard.
 *
 * Upload → choose sheet → review mapping → preview → result.
 *
 * ## Why "choose sheet" is a step of its own
 *
 * A real sales workbook is not one table. The file this was built for holds six
 * tabs: two lead registers, two hotel-booking ledgers, a scratchpad with no
 * header row, and one whose headers sit a column out of line with its data.
 * Importing them all would create leads for hotel rooms; importing only the
 * first would silently lose five sixths of the file. So the server classifies
 * every sheet, says why, and the user picks.
 *
 * The preview runs the **same** code path as the import with `dryRun`, so what
 * it promises and what happens cannot diverge.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileSpreadsheet,
  Info,
  Mail,
  MailX,
  Undo2,
  Upload,
} from 'lucide-react'

import { inspectWorkbook, rollbackImport, syncWorkbook } from '@/api/services/lead.service'
import { queueWorkbookSync } from '@/api/services/workbook.service'
import { LeadStageBadge } from '@/components/leads/LeadStageBadge'
import { WorkbookJobProgress } from '@/components/leads/WorkbookJobProgress'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { IMPORT_STEPS, LEAD_FIELDS, SHEET_KIND_STYLES } from '@/constants/lead.constants'
import { useActiveTemplate } from '@/hooks/useTemplates'
import { useWorkbookJob } from '@/hooks/useWorkbookJob'
import { ROUTE_PATHS } from '@/routes/paths'

export function LeadImportPage() {
  const fileInput = useRef(null)

  // Which template a send would use, so the mapping step can say so — and warn
  // before the upload if there is none.
  const { hasActiveTemplate, template: activeTemplate } = useActiveTemplate()

  const [step, setStep] = useState(0)
  const [file, setFile] = useState(null)
  const [inspection, setInspection] = useState(null)
  const [sheetName, setSheetName] = useState(null)
  const [mapping, setMapping] = useState([])
  /**
   * Automatic mail for this run.
   *
   * On by default — sending to genuinely new enquiries is the whole point of
   * the upload. Turning it off imports without writing to anyone, which is what
   * a first backfill of historical rows needs.
   */
  const [sendMail, setSendMail] = useState(true)

  /**
   * Re-send to leads already introduced.
   *
   * Off, and it stays off unless a person ticks it. This is the only way past
   * the guarantee that a customer is never introduced twice.
   */
  const [forceResend, setForceResend] = useState(false)
  const [preview, setPreview] = useState(null)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  /** The queued run. Null until the import is submitted. */
  const [jobId, setJobId] = useState(null)
  const { job, isFinished, cancel, isCancelling } = useWorkbookJob(jobId)

  /**
   * The finished run becomes the result the summary screen already renders.
   *
   * Shaped to match what the synchronous endpoint returned, so the screen below
   * did not have to change — it was already correct, and rewriting it to read a
   * job would have been a second way to display the same numbers.
   */
  useEffect(() => {
    if (!isFinished || !job) return

    setResult({
      importJob: job.id,
      ...job.summary,
      emailsSent: job.emailsSent,
      durationMs: job.durationMs,
      status: job.status,
    })
  }, [isFinished, job])

  const sheet = useMemo(
    () => inspection?.sheets?.find((candidate) => candidate.name === sheetName) ?? null,
    [inspection, sheetName],
  )

  const fail = (thrown) =>
    setError(thrown?.response?.data?.message ?? thrown?.message ?? 'Something went wrong.')

  // --- 1. Upload -----------------------------------------------------------
  const handleFile = useCallback(async (chosen) => {
    if (!chosen) return

    setBusy(true)
    setError(null)
    setFile(chosen)

    try {
      const data = await inspectWorkbook(chosen)
      setInspection(data)
      setSheetName(data.recommended ?? data.sheets?.[0]?.name ?? null)
      setStep(1)
    } catch (thrown) {
      fail(thrown)
      setFile(null)
    } finally {
      setBusy(false)
    }
  }, [])

  // --- 2 → 3. Sheet chosen, load its mapping -------------------------------
  const chooseSheet = useCallback(() => {
    if (!sheet) return
    setMapping(sheet.mapping ?? [])
    setError(null)
    setStep(2)
  }, [sheet])

  // --- 3 → 4. Preview ------------------------------------------------------
  const runPreview = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const data = await syncWorkbook(file, {
        sheet: sheetName,
        mapping: mapping.map(({ column, index, field }) => ({ column, index, field })),
        dryRun: true,
        sendMail,
      })
      setPreview(data)
      setStep(3)
    } catch (thrown) {
      fail(thrown)
    } finally {
      setBusy(false)
    }
  }, [file, sheetName, mapping, sendMail])

  /**
   * 4 → 5. Import.
   *
   * Queued rather than run inline. A morning with 500 new enquiries is paced at
   * roughly two seconds a message, which held the old request open for up to
   * seventeen minutes — long enough that every proxy in the path closed the
   * connection and the operator saw a failure for work that had actually
   * succeeded. Now the upload returns a job id and the page follows the run.
   *
   * The preview above still runs inline: a dry run writes nothing and returns
   * in milliseconds, so queueing it would add latency to the one step that does
   * not need it.
   */
  const runImport = useCallback(async () => {
    setBusy(true)
    setError(null)

    // Cleared before queueing, or a second import in the same session would
    // show the previous run's summary the instant step 4 renders.
    setResult(null)
    setJobId(null)

    try {
      const queued = await queueWorkbookSync(file, {
        sheet: sheetName,
        mapping: mapping.map(({ column, index, field }) => ({ column, index, field })),
        sendMail,
        forceResend,
      })

      setJobId(queued.jobId)
      setStep(4)
    } catch (thrown) {
      fail(thrown)
    } finally {
      setBusy(false)
    }
  }, [file, sheetName, mapping, sendMail, forceResend])

  const undo = useCallback(async () => {
    if (!result?.importJob) return
    if (!window.confirm('Remove every lead this import created? Companies and contacts that nothing else references are removed too.')) return

    setBusy(true)
    try {
      const rolled = await rollbackImport(result.importJob)
      setResult((current) => ({ ...current, rolledBack: rolled }))
    } catch (thrown) {
      fail(thrown)
    } finally {
      setBusy(false)
    }
  }, [result])

  return (
    <div className="space-y-6">
      {/* --- Stepper ------------------------------------------------------ */}
      <ol className="flex flex-wrap gap-2" aria-label="Import progress">
        {IMPORT_STEPS.map((item, index) => {
          const state = index === step ? 'current' : index < step ? 'done' : 'todo'
          return (
            <li key={item.id}>
              <span
                aria-current={state === 'current' ? 'step' : undefined}
                className={[
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset',
                  state === 'current' && 'bg-brand-600 text-white ring-brand-600',
                  state === 'done' && 'bg-emerald-50 text-emerald-700 ring-emerald-200',
                  state === 'todo' && 'bg-white text-slate-500 ring-slate-200',
                ].filter(Boolean).join(' ')}
              >
                {state === 'done' && <Check className="size-3" aria-hidden="true" />}
                {index + 1}. {item.label}
              </span>
            </li>
          )
        })}
      </ol>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        {busy && (
          <div className="flex justify-center py-10">
            <Spinner label="Working" />
          </div>
        )}

        {/* --- Step 1: upload -------------------------------------------- */}
        {!busy && step === 0 && (
          <div className="text-center">
            <FileSpreadsheet className="mx-auto size-10 text-slate-300" aria-hidden="true" />
            <h2 className="mt-3 text-base font-semibold text-slate-900">Upload the sales workbook</h2>
            <p className="mx-auto mt-1 max-w-lg text-sm text-slate-500">
              Every worksheet is read and classified. Nothing is written until you have seen the
              preview.
            </p>

            <input
              ref={fileInput}
              type="file"
              accept=".xlsx"
              className="sr-only"
              onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
            />

            <Button className="mt-5" onClick={() => fileInput.current?.click()}>
              <Upload className="size-4" aria-hidden="true" />
              Choose an .xlsx file
            </Button>

            <p className="mt-3 text-xs text-slate-400">
              For a single-table CSV or a legacy .xls, use the contacts importer instead.
            </p>
          </div>
        )}

        {/* --- Step 2: choose the sheet ----------------------------------- */}
        {!busy && step === 1 && inspection && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                {inspection.sheets.length} worksheets in {inspection.filename}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Only lead registers can be imported. Each classification is explained.
              </p>
            </div>

            <ul className="space-y-2">
              {inspection.sheets.map((candidate) => {
                const kind = SHEET_KIND_STYLES[candidate.kind] ?? SHEET_KIND_STYLES.unknown
                const selectable = kind.importable

                return (
                  <li key={candidate.name}>
                    <label
                      className={[
                        'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition',
                        selectable ? 'border-slate-200 hover:border-blue-400' : 'border-slate-200 opacity-70',
                        sheetName === candidate.name && 'border-blue-500 bg-blue-50/40',
                      ].filter(Boolean).join(' ')}
                    >
                      <input
                        type="radio"
                        name="sheet"
                        className="mt-1 size-4"
                        disabled={!selectable}
                        checked={sheetName === candidate.name}
                        onChange={() => setSheetName(candidate.name)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-slate-900">{candidate.name}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${kind.className}`}>
                            {kind.label}
                          </span>
                          <span className="text-xs text-slate-400">{candidate.rowCount.toLocaleString()} rows</span>
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">{candidate.reason}</span>

                        {candidate.corrections?.length > 0 && (
                          <span className="mt-1.5 block rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-800">
                            <Info className="mr-1 inline size-3" aria-hidden="true" />
                            {candidate.corrections.map((correction) => correction.reason).join(' ')}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>

            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => { setStep(0); setInspection(null); setFile(null) }}>
                <ArrowLeft className="size-4" aria-hidden="true" />
                Choose another file
              </Button>
              <Button onClick={chooseSheet} disabled={!sheet || !SHEET_KIND_STYLES[sheet.kind]?.importable}>
                Continue
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}

        {/* --- Step 3: mapping -------------------------------------------- */}
        {!busy && step === 2 && sheet && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Column mapping for “{sheet.name}”</h2>
              <p className="mt-1 text-sm text-slate-500">
                Detected from the headers, then checked against the data. Change anything that looks
                wrong.
              </p>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">Spreadsheet column</th>
                    <th scope="col" className="px-3 py-2 font-medium">Sample</th>
                    <th scope="col" className="px-3 py-2 font-medium">CRM field</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {mapping.map((entry, position) => (
                    <tr key={entry.index}>
                      <td className="px-3 py-2">
                        <span className="font-medium text-slate-900">{entry.column || <em className="text-slate-400">(blank)</em>}</span>
                        {entry.source === 'content' && (
                          <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">
                            corrected
                          </span>
                        )}
                      </td>
                      <td className="max-w-64 truncate px-3 py-2 text-xs text-slate-500">
                        {(sheet.preview ?? [])
                          .map((row) => row[entry.index])
                          .filter((value) => value !== undefined && String(value).trim() !== '')
                          .slice(0, 2)
                          .join(' · ') || '—'}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={entry.field}
                          onChange={(event) =>
                            setMapping((current) =>
                              current.map((item, itemIndex) =>
                                itemIndex === position ? { ...item, field: event.target.value } : item,
                              ),
                            )
                          }
                          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                        >
                          {LEAD_FIELDS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              {/*
                Checked before the upload rather than after.
                Without an active template the server refuses the run — correctly
                — but discovering that after waiting for a 1,700-row import is a
                wasted morning, and the fix is two clicks away.
              */}
              {sendMail && hasActiveTemplate === false && (
                <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    <strong>No email template is active</strong>, so this run will be refused. Activate
                    one in{' '}
                    <Link to={ROUTE_PATHS.TEMPLATES} className="font-medium underline">
                      Email templates
                    </Link>
                    , or untick the box below to import without sending.
                  </span>
                </p>
              )}

              {sendMail && activeTemplate && (
                <p className="text-xs text-slate-500">
                  New enquiries will receive <strong className="text-slate-700">{activeTemplate.name}</strong>{' '}
                  (version {activeTemplate.version}).{' '}
                  <Link to={ROUTE_PATHS.TEMPLATE_EDIT.replace(':id', activeTemplate.id)} className="underline">
                    Review it
                  </Link>
                  .
                </p>
              )}

              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={sendMail}
                  onChange={(event) => setSendMail(event.target.checked)}
                  className="mt-0.5 size-4 rounded border-slate-300"
                />
                <span>
                  Email the new enquiries automatically
                  <span className="block text-xs text-slate-400">
                    Only rows this workbook introduces for the first time. An enquiry already on
                    file is never written to again, however many mornings it reappears.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={forceResend}
                  onChange={(event) => setForceResend(event.target.checked)}
                  disabled={!sendMail}
                  className="mt-0.5 size-4 rounded border-slate-300"
                />
                <span className={sendMail ? '' : 'opacity-50'}>
                  Force a resend
                  <span className="block text-xs text-amber-700">
                    Overrides the guarantee above. Customers who have already had the introduction
                    will receive it again. Leave this off unless you mean it.
                  </span>
                </span>
              </label>
            </div>

            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep(1)}>
                <ArrowLeft className="size-4" aria-hidden="true" />
                Back
              </Button>
              <Button onClick={runPreview}>
                Preview
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}

        {/* --- Step 4: preview, the comparison ---------------------------- */}
        {!busy && step === 3 && preview && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Compared with what is already on file
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Matched on reference. Nothing has been written and nothing has been sent.
              </p>
            </div>

            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['New', preview.counts.new, 'will be created and emailed', 'emerald'],
                ['Updated', preview.counts.updated, 'details changed — no email', 'blue'],
                ['Unchanged', preview.counts.unchanged, 'already on file, untouched', 'slate'],
                ['Invalid', preview.counts.invalid, 'cannot be imported', 'rose'],
              ].map(([label, value, hint, tone]) => (
                <div
                  key={label}
                  className={[
                    'rounded-lg border p-3',
                    tone === 'emerald' && 'border-emerald-200 bg-emerald-50/50',
                    tone === 'blue' && 'border-blue-200 bg-blue-50/40',
                    tone === 'rose' && Number(value) > 0 && 'border-rose-200 bg-rose-50/50',
                    (tone === 'slate' || (tone === 'rose' && Number(value) === 0)) && 'border-slate-200',
                  ].filter(Boolean).join(' ')}
                >
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
                  <dd className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-900">
                    {Number(value ?? 0).toLocaleString()}
                  </dd>
                  <dd className="mt-0.5 text-xs text-slate-400">{hint}</dd>
                </div>
              ))}
            </dl>

            {/* The sentence the whole product exists to be able to say. */}
            <p
              className={[
                'flex items-start gap-2 rounded-lg px-4 py-3 text-sm ring-1 ring-inset',
                sendMail
                  ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                  : 'bg-slate-50 text-slate-700 ring-slate-200',
              ].join(' ')}
            >
              {sendMail
                ? <Mail className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                : <MailX className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
              <span>
                {sendMail ? (
                  <>
                    <strong>{(preview.mailable ?? 0).toLocaleString()}</strong> email(s) will be sent
                    — to the new enquiries only.
                    {preview.counts.new > (preview.mailable ?? 0) && (
                      <> {preview.counts.new - (preview.mailable ?? 0)} new row(s) have no address.</>
                    )}
                    {preview.counts.unchanged > 0 && (
                      <> The {preview.counts.unchanged.toLocaleString()} unchanged enquiry/enquiries
                      will not be contacted again.</>
                    )}
                  </>
                ) : (
                  <>Automatic mail is off for this run. Leads will be created without contacting anyone.</>
                )}
              </span>
            </p>

            {/* Row-by-row verdict */}
            {preview.rows?.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-medium">Row</th>
                      <th scope="col" className="px-3 py-2 font-medium">Reference</th>
                      <th scope="col" className="px-3 py-2 font-medium">Verdict</th>
                      <th scope="col" className="px-3 py-2 font-medium">Contact</th>
                      {/*
                        The stage the sheet's Status column resolved to.
                        Shown because it is the one imported value the user
                        cannot otherwise check before committing: every other
                        column appears verbatim in the file, whereas Status is
                        translated ("Closed" becomes Completed) and, for an
                        enquiry already on file, is deliberately *not* applied.
                      */}
                      <th scope="col" className="px-3 py-2 font-medium">Stage</th>
                      <th scope="col" className="px-3 py-2 font-medium">What changed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.rows.slice(0, 60).map((entry) => (
                      <tr key={entry.rowNumber}>
                        <td className="px-3 py-1.5 tabular-nums text-slate-400">{entry.rowNumber}</td>
                        <td className="px-3 py-1.5 font-mono text-xs">{entry.reference ?? '—'}</td>
                        <td className="px-3 py-1.5">
                          <span
                            className={[
                              'rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
                              entry.category === 'new' && 'bg-emerald-50 text-emerald-700 ring-emerald-200',
                              entry.category === 'updated' && 'bg-blue-50 text-blue-700 ring-blue-200',
                              entry.category === 'unchanged' && 'bg-slate-100 text-slate-500 ring-slate-200',
                              entry.category === 'invalid' && 'bg-rose-50 text-rose-700 ring-rose-200',
                            ].filter(Boolean).join(' ')}
                          >
                            {entry.category}
                          </span>
                        </td>
                        <td className="max-w-40 truncate px-3 py-1.5 text-slate-600">
                          {entry.data?.contactPerson ?? '—'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5">
                          {/*
                            Only a new enquiry takes its stage from the sheet.
                            An enquiry already on file keeps the stage the CRM
                            holds — `stage` is absent from both COMPARED_FIELDS
                            and the sync's writable fields — so showing the
                            sheet's value here would promise a change that the
                            import will not make.
                          */}
                          {entry.category === 'new' && entry.data?.stage ? (
                            <LeadStageBadge stage={entry.data.stage} />
                          ) : entry.category === 'invalid' ? (
                            <span className="text-slate-300">—</span>
                          ) : (
                            <span
                              className="text-xs text-slate-400"
                              title="This enquiry is already on file. The CRM's own stage is kept; the workbook's Status is not applied to it."
                            >
                              keeps current
                            </span>
                          )}
                        </td>
                        <td className="max-w-72 px-3 py-1.5 text-xs text-slate-500">
                          {entry.category === 'updated' && entry.changes?.length > 0
                            ? entry.changes.map((c) => `${c.label}: ${c.from ?? '—'} → ${c.to ?? '—'}`).join('; ')
                            : entry.category === 'invalid'
                              ? (entry.reasons ?? []).join(' ')
                              : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.rows.length > 60 && (
                  <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-400">
                    Showing the first 60 of {preview.rows.length.toLocaleString()} rows.
                  </p>
                )}
              </div>
            )}

            {preview.issues?.length > 0 && (
              <details className="rounded-lg border border-slate-200 p-3">
                <summary className="cursor-pointer text-sm font-medium text-slate-700">
                  {preview.issues.length}{preview.issuesTruncated ? '+' : ''} issue(s)
                </summary>
                <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-xs">
                  {preview.issues.slice(0, 100).map((issue, index) => (
                    <li key={index} className={issue.severity === 'error' ? 'text-rose-700' : 'text-amber-700'}>
                      Row {issue.row}{issue.field ? ` · ${issue.field}` : ''}: {issue.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep(2)}>
                <ArrowLeft className="size-4" aria-hidden="true" />
                Adjust the mapping
              </Button>
              <Button
                onClick={runImport}
                disabled={preview.counts.new + preview.counts.updated === 0}
                size="lg"
              >
                {preview.counts.new > 0
                  ? `Import ${preview.counts.new} new${sendMail ? ` and send ${preview.mailable ?? 0}` : ''}`
                  : preview.counts.updated > 0
                    ? `Apply ${preview.counts.updated} update(s)`
                    : 'Nothing to import'}
              </Button>
            </div>
          </div>
        )}

        {/* --- Step 5: the report ------------------------------------------ */}
        {/*
          The run itself, while it is running.
          Replaced by the summary below the moment it finishes — the same
          summary the synchronous import always showed.
        */}
        {step === 4 && !result && (
          <WorkbookJobProgress job={job} onCancel={cancel} isCancelling={isCancelling} />
        )}

        {!busy && step === 4 && result && (
          <div className="space-y-4">
            {/* Kept above the summary so a resumed or cancelled run says so. */}
            {job && (job.status !== 'completed' || job.attempts > 1) && (
              <WorkbookJobProgress job={job} onCancel={cancel} isCancelling={isCancelling} />
            )}

            <div className="text-center">
              <CheckCircle2 className="mx-auto size-10 text-emerald-500" aria-hidden="true" />
              <h2 className="mt-3 text-base font-semibold text-slate-900">Workbook processed</h2>
              <p className="mt-1 text-sm text-slate-500">
                {result.durationMs != null && `Took ${(result.durationMs / 1000).toFixed(1)}s. `}
                {result.total?.toLocaleString()} row(s) read.
              </p>
            </div>

            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['New leads', result.created],
                ['Updated', result.modified],
                ['Unchanged', result.unchanged],
                ['Invalid', result.invalid],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-slate-200 p-3 text-center">
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
                  <dd className="mt-0.5 text-2xl font-semibold tabular-nums text-slate-900">
                    {Number(value ?? 0).toLocaleString()}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-900">
                <Mail className="size-4" aria-hidden="true" />
                {(result.emailsSent ?? 0).toLocaleString()} email(s) sent to new enquiries
              </p>
              {(result.emailsSkipped > 0 || result.emailsFailed > 0) && (
                <p className="mt-1 text-xs text-emerald-800">
                  {result.emailsSkipped > 0 && `${result.emailsSkipped} skipped`}
                  {result.emailsSkipped > 0 && result.emailsFailed > 0 && ' · '}
                  {result.emailsFailed > 0 && `${result.emailsFailed} failed`}
                  {result.skipReasons && Object.keys(result.skipReasons).length > 0 && (
                    <> — {Object.entries(result.skipReasons).map(([k, v]) => `${v} ${k.replace(/_/g, ' ')}`).join(', ')}</>
                  )}
                </p>
              )}
              {result.mockMode && (
                <p className="mt-1 text-xs text-emerald-700">
                  Simulated — no mailbox is connected, so nothing left the machine.
                </p>
              )}
            </div>

            {result.rolledBack && (
              <p className="rounded-lg bg-slate-50 px-4 py-2.5 text-sm text-slate-700 ring-1 ring-inset ring-slate-200">
                Rolled back: {result.rolledBack.leads} lead(s), {result.rolledBack.contactsRemoved} contact(s)
                and {result.rolledBack.companiesRemoved} company/companies removed.
              </p>
            )}

            <div className="flex flex-wrap justify-center gap-2">
              <Button as={Link} to={ROUTE_PATHS.LEADS}>View the register</Button>
              <Button as={Link} to={ROUTE_PATHS.LEAD_PIPELINE} variant="secondary">Open the pipeline</Button>
              {!result.rolledBack && result.created > 0 && (
                <Button variant="ghost" onClick={undo}>
                  <Undo2 className="size-4" aria-hidden="true" />
                  Undo this import
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default LeadImportPage
