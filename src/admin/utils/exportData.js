/**
 * Client-side export.
 *
 * ## Why CSV, and why no new dependency
 *
 * The data being exported is already in the browser — it is what the table just
 * rendered. Round-tripping it to the server to have a file generated would add
 * an endpoint, a permission and a second copy of the column definitions, all to
 * produce something the client can already write.
 *
 * **Excel** opens CSV natively, and a `.xlsx` writer is ~200 KB of dependency to
 * produce a format the recipient will open in the same program. The file is
 * named and typed so Excel claims it.
 *
 * **PDF** is the browser's print dialogue, which every browser can already
 * render to PDF. A PDF library would be another ~300 KB to reproduce, worse,
 * what the print stylesheet already does — and it would not pick up the reader's
 * paper size or margins.
 *
 * ## Escaping
 *
 * Two things bite here and both are handled: a value containing a comma, quote
 * or newline must be quoted with its quotes doubled, or the file silently
 * gains a column. And a value beginning `=`, `+`, `-` or `@` is executed as a
 * formula by Excel on open — the CSV-injection vector — so it is prefixed.
 */

/**
 * Escapes one field.
 *
 * @param {unknown} value
 * @returns {string}
 */
function escapeCell(value) {
  if (value === null || value === undefined) return ''

  let text = String(value)

  /**
   * Formula injection.
   *
   * Excel and Sheets evaluate a cell starting with one of these. A contact named
   * `=cmd|...` in an exported CRM file is a real attack, and the mitigation is a
   * leading apostrophe, which both programs strip on display.
   */
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`

  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`

  return text
}

/**
 * Builds CSV text from columns and rows.
 *
 * @param {Array<{ key: string, header: string, value?: (row: object) => unknown }>} columns
 * @param {object[]} rows
 * @returns {string}
 */
export function toCsv(columns, rows) {
  const header = columns.map((column) => escapeCell(column.header)).join(',')

  const body = rows.map((row) =>
    columns
      .map((column) => escapeCell(column.value ? column.value(row) : row[column.key]))
      .join(','),
  )

  // CRLF: the line ending the CSV RFC specifies and the one Excel on Windows
  // expects. A lone LF opens fine but shows as one long line in some tools.
  return [header, ...body].join('\r\n')
}

/**
 * Triggers a download.
 *
 * A BOM is prepended so Excel detects UTF-8. Without it, Excel on Windows reads
 * the file as the system codepage and every accented name in the export is
 * mangled — which is most of the point of exporting a contact list.
 */
export function downloadCsv(filename, csv) {
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`

  document.body.append(link)
  link.click()
  link.remove()

  // Released on the next tick — revoking synchronously can cancel the download
  // in some browsers before it has read the blob.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/**
 * A filename stamped with the period it covers.
 *
 * An export called `team.csv` is indistinguishable from last month's export
 * called `team.csv` the moment both are in a downloads folder.
 */
export function exportFilename(base, range) {
  const stamp = range?.from
    ? `${String(range.from).slice(0, 10)}_${String(range.to ?? '').slice(0, 10)}`
    : new Date().toISOString().slice(0, 10)

  return `${base}_${stamp}.csv`
}

/**
 * Opens the browser's print dialogue, which can save as PDF.
 *
 * Deliberately not a PDF library. Every browser prints to PDF, honours the
 * reader's paper size, and applies the page's own print styles — none of which a
 * bundled renderer would do as well.
 */
export function printView() {
  window.print()
}

export default { downloadCsv, exportFilename, printView, toCsv }
