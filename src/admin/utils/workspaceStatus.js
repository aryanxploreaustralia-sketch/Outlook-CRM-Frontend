/**
 * Reduces the admin dashboard payload to one status sentence.
 *
 * Split out of `AdminGreeting` so that file exports only components and
 * Fast Refresh can hot-swap it — the same rule the chart palette and the
 * audit constants follow.
 */

export function deriveStatus(data) {
  if (!data) return null

  const concerns = []

  // Each check is defensive about `null`: a block the server could not read is
  // unknown, not healthy, and must not silently count as fine.
  if (data.mailboxes && data.mailboxes.disconnected > 0) {
    concerns.push(
      `${data.mailboxes.disconnected} mailbox${data.mailboxes.disconnected === 1 ? '' : 'es'} disconnected`,
    )
  }

  if (data.mailboxes && data.mailboxes.error > 0) {
    concerns.push(`${data.mailboxes.error} mailbox connection error${data.mailboxes.error === 1 ? '' : 's'}`)
  }

  if (data.imports && data.imports.failed > 0) {
    concerns.push(`${data.imports.failed} failed import${data.imports.failed === 1 ? '' : 's'}`)
  }

  if (data.mail && data.mail.failed > 0) {
    concerns.push(`${data.mail.failed} message${data.mail.failed === 1 ? '' : 's'} failed to send`)
  }

  if (data.scheduler && data.scheduler.configured && data.scheduler.lastStatus === 'failed') {
    concerns.push('the last scheduled run failed')
  }

  return concerns.length === 0
    ? { tone: 'ok', message: 'Everything is running normally.' }
    : {
        tone: 'attention',
        // Two at most. A status line listing five problems is a list, and a
        // list is what the page below already is.
        message: `${concerns.slice(0, 2).join(', ')}${concerns.length > 2 ? `, and ${concerns.length - 2} more` : ''}.`,
      }
}


export default deriveStatus
