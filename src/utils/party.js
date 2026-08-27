/**
 * How the CRM describes who is travelling. One place, one answer.
 *
 * ## Why the total is computed rather than read
 *
 * `paxText` is the workbook's own wording — `"2A + 2 C"`, `"4A+3C"`,
 * `"15-35 Pax"` — and it is not a number. Reading a total out of it means
 * guessing, and guessing wrong: the leading digit of `"2A + 2 C"` is 2, while
 * the party is four people. The importer already resolved that text into
 * `adultCount` and `childCount`, so the total is their sum and nothing else
 * needs to parse anything.
 *
 * ## When the counts are missing
 *
 * 211 of the register's enquiries have neither count, and 90 have no `paxText`
 * either. A missing count is not zero — it means the sheet said something the
 * importer could not resolve — so those fall back to the original wording,
 * shown exactly as written, and an enquiry with nothing at all reports nothing
 * rather than "0 Pax".
 *
 * A missing `childCount` beside a present `adultCount` is different: 6,186
 * enquiries are in that state, and every one of them means "no children were
 * mentioned". That reads as zero.
 */

/** "1 Adult", "45 Adults", "1 Child", "0 Children". */
const plural = (count, singular, pluralForm) => `${count} ${count === 1 ? singular : pluralForm}`

/**
 * @param {{ adultCount?: ?number, childCount?: ?number, paxText?: ?string }} lead
 * @returns {{ total: ?number, summary: ?string, breakdown: ?string, text: ?string }}
 *   `summary` is the headline ("45 Pax"), `breakdown` the split
 *   ("45 Adults · 0 Children"), and `text` the two joined for a single line.
 *   All are null when the enquiry records nothing, so a caller can render its
 *   own em dash rather than being handed one.
 */
export function describeParty(lead = {}) {
  const { adultCount, childCount, paxText } = lead

  const hasAdults = Number.isFinite(adultCount)
  const hasChildren = Number.isFinite(childCount)

  if (hasAdults || hasChildren) {
    const adults = hasAdults ? adultCount : 0
    const children = hasChildren ? childCount : 0
    const total = adults + children

    const summary = `${total} Pax`
    const breakdown = `${plural(adults, 'Adult', 'Adults')} · ${plural(children, 'Child', 'Children')}`

    return { total, summary, breakdown, text: `${summary} (${breakdown})` }
  }

  // Nothing was resolved. The sheet's own wording is the best answer there is.
  const written = typeof paxText === 'string' ? paxText.trim() : ''

  return written
    ? { total: null, summary: written, breakdown: null, text: written }
    : { total: null, summary: null, breakdown: null, text: null }
}

export default describeParty
