/**
 * Import contacts from a file.
 *
 * The per-row result table is the important part. A bulk import that reports
 * only "412 imported" leaves a user unable to find out what happened to the
 * other six, so every skipped and failed row is listed with its reason and its
 * spreadsheet row number.
 */

import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft, CheckCircle2, FileUp, Upload } from 'lucide-react'

import {
  fileToBase64,
  formatFromFilename,
  importContacts,
} from '@/api/services/contact.service'
import { Button } from '@/components/ui/Button'
import { IMPORT_MODES, TRANSFER_FORMATS } from '@/constants/contact.constants'
import { ROUTE_PATHS } from '@/routes/paths'

/** Colour per row outcome. */
const OUTCOME_TONES = {
  created: 'text-emerald-700',
  updated: 'text-blue-700',
  skipped: 'text-slate-500',
  failed: 'text-red-700',
}

export function ContactImportPage() {
  const inputRef = useRef(null)

  const [file, setFile] = useState(null)
  const [format, setFormat] = useState('csv')
  const [mode, setMode] = useState('skip_duplicates')
  const [tagInput, setTagInput] = useState('')
  const [isImporting, setIsImporting] = useState(false)
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState(null)
  const [isDragging, setIsDragging] = useState(false)

  const selectFile = useCallback((chosen) => {
    if (!chosen) return
    setFile(chosen)
    // The extension is a better guess than whatever the dropdown last showed.
    setFormat(formatFromFilename(chosen.name))
    setSummary(null)
    setError(null)
  }, [])

  const handleImport = useCallback(async () => {
    if (!file) return

    setIsImporting(true)
    setError(null)
    setSummary(null)

    try {
      const content = await fileToBase64(file)
      const defaultTags = tagInput
        .split(',')
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)

      setSummary(await importContacts({ content, format, mode, defaultTags }))
    } catch (caught) {
      setError(caught)
    } finally {
      setIsImporting(false)
    }
  }, [file, format, mode, tagInput])

  // Rows worth showing individually. A list of 400 successful creates is noise;
  // the exceptions are what the user needs.
  const notableRows = summary?.details?.filter((row) => row.outcome !== 'created') ?? []

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link
        to={ROUTE_PATHS.CONTACTS}
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-brand-600"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Contacts
      </Link>

      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          Import contacts
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          CSV, Excel, vCard or JSON. Column names from Outlook and Google exports are recognised
          automatically.
        </p>
      </div>

      {/* --- File chooser --------------------------------------------------- */}
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          selectFile(event.dataTransfer.files?.[0])
        }}
        className={`rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          isDragging ? 'border-brand-400 bg-brand-50' : 'border-slate-300 bg-white'
        }`}
      >
        <FileUp className="mx-auto size-8 text-slate-300" aria-hidden="true" />

        {file ? (
          <>
            <p className="mt-3 text-sm font-medium text-slate-900">{file.name}</p>
            <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB</p>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm font-medium text-slate-700">Drop a file here</p>
            <p className="text-xs text-slate-500">or choose one from your computer</p>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".csv,.vcf,.xlsx,.json"
          onChange={(event) => selectFile(event.target.files?.[0])}
          className="sr-only"
          aria-label="Choose a file to import"
        />

        <Button variant="secondary" size="sm" className="mt-3" onClick={() => inputRef.current?.click()}>
          {file ? 'Choose a different file' : 'Choose file'}
        </Button>
      </div>

      {/* --- Options -------------------------------------------------------- */}
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <span className="mb-1.5 block text-xs font-medium text-slate-600">Format</span>
          <div className="flex flex-wrap gap-2">
            {TRANSFER_FORMATS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFormat(option.value)}
                aria-pressed={format === option.value}
                title={option.hint}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors ${
                  format === option.value
                    ? 'bg-brand-50 text-brand-700 ring-brand-300'
                    : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-medium text-slate-600">
            When a contact already exists
          </span>
          <div className="space-y-2">
            {IMPORT_MODES.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                  mode === option.value ? 'border-brand-300 bg-brand-50/50' : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="import-mode"
                  value={option.value}
                  checked={mode === option.value}
                  onChange={(event) => setMode(event.target.value)}
                  className="mt-0.5 size-4 border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-900">{option.label}</span>
                  <span className="block text-xs text-slate-500">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            Tags to apply to every imported contact
          </span>
          <input
            type="text"
            value={tagInput}
            onChange={(event) => setTagInput(event.target.value)}
            placeholder="trade-fair, 2026 (comma separated, optional)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"
          />
        </label>

        <div className="flex justify-end">
          <Button onClick={handleImport} isLoading={isImporting} loadingLabel="Importing…" disabled={!file}>
            <Upload className="size-4" aria-hidden="true" />
            Import contacts
          </Button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">{error.message}</p>
            {Array.isArray(error.details) && (
              <ul className="mt-1 list-inside list-disc text-xs">
                {error.details.map((issue, index) => (
                  <li key={index}>{issue.field}: {issue.message}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* --- Result --------------------------------------------------------- */}
      {summary && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-emerald-600" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-slate-900">Import complete</h2>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              { label: 'Rows', value: summary.total, tone: 'text-slate-900' },
              { label: 'Created', value: summary.created, tone: 'text-emerald-700' },
              { label: 'Updated', value: summary.updated, tone: 'text-blue-700' },
              { label: 'Skipped', value: summary.skipped, tone: 'text-slate-500' },
              { label: 'Failed', value: summary.failed, tone: 'text-red-700' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-[11px] text-slate-500">{stat.label}</p>
                <p className={`text-lg font-semibold ${stat.tone}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          {notableRows.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-600">
                Rows needing attention ({notableRows.length})
              </p>
              <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-1.5 font-medium">Row</th>
                      <th className="px-3 py-1.5 font-medium">Outcome</th>
                      <th className="px-3 py-1.5 font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {notableRows.map((row, index) => (
                      <tr key={index}>
                        <td className="px-3 py-1.5 text-slate-500">{row.row}</td>
                        <td className={`px-3 py-1.5 font-medium capitalize ${OUTCOME_TONES[row.outcome]}`}>
                          {row.outcome}
                        </td>
                        <td className="px-3 py-1.5 text-slate-600">{row.reason ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button as={Link} to={ROUTE_PATHS.CONTACTS}>View contacts</Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ContactImportPage
