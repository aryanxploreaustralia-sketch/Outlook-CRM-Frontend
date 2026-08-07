/**
 * The correspondence on an enquiry.
 *
 * ## Why this is not a mailbox
 *
 * It shows one thread — our introduction, the customer's answer, and whatever
 * followed — and nothing else. No folders, no compose window, no unrelated
 * mail. A salesperson opening an enquiry wants the answer to "what has been
 * said about this trip?", and every mailbox affordance added here would be
 * another thing between them and that answer.
 *
 * ## Ours on the right, theirs on the left
 *
 * The chat convention, because that is what a thread is, and because direction
 * is the single most important thing to read at a glance. Colour carries it
 * too, so it survives a narrow screen where the alignment collapses.
 */

import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Download,
  Inbox,
  Mail,
  MailQuestion,
  Paperclip,
  Send,
} from 'lucide-react'

/** Formats an ISO timestamp, tolerating null and invalid input. */
function formatDateTime(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString()
}

function formatBytes(bytes) {
  if (!bytes) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * How a reply kind is labelled.
 *
 * Only the machine-generated kinds get a badge. Labelling an ordinary reply
 * "reply" would be noise on the overwhelming majority of messages.
 */
const REPLY_KIND_BADGE = {
  out_of_office: { label: 'Out of office', tone: 'bg-amber-50 text-amber-700' },
  auto_reply: { label: 'Automatic reply', tone: 'bg-amber-50 text-amber-700' },
  bounce: { label: 'Bounced', tone: 'bg-red-50 text-red-700' },
  forward: { label: 'Forwarded', tone: 'bg-slate-100 text-slate-600' },
}

/** One message in the thread. */
function Message({ message, attachments }) {
  const [isOpen, setIsOpen] = useState(false)

  const isIncoming = message.direction === 'incoming'
  const badge = REPLY_KIND_BADGE[message.replyKind]

  const mine = attachments.filter((file) => file.message === message.id)

  /**
   * The plain-text body is preferred over the HTML.
   *
   * Rendering a customer's HTML would mean either sanitising it here — a
   * security decision made in a presentation component — or accepting stored
   * XSS from anyone who can email us. The text carries what a salesperson needs
   * to read, and the full message is a click away in Outlook.
   */
  const body = (message.bodyText ?? '').trim()
  const preview = body.length > 320 ? `${body.slice(0, 320)}…` : body
  const isTruncated = body.length > 320

  return (
    <li className={`flex ${isIncoming ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[85%] min-w-0 rounded-xl border px-3.5 py-2.5 ${
          isIncoming ? 'border-slate-200 bg-white' : 'border-brand-100 bg-brand-50/60'
        }`}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium ${
              isIncoming ? 'text-slate-700' : 'text-brand-700'
            }`}
          >
            {isIncoming ? (
              <Inbox className="size-3.5" aria-hidden="true" />
            ) : (
              <Send className="size-3.5" aria-hidden="true" />
            )}
            {isIncoming ? (message.from?.name || message.from?.address || 'Customer') : 'You'}
          </span>

          <span className="text-[11px] text-slate-400">{formatDateTime(message.occurredAt)}</span>

          {badge && (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${badge.tone}`}>
              {badge.label}
            </span>
          )}
        </div>

        {message.subject && (
          <p className="mt-1 truncate text-xs font-medium text-slate-700">{message.subject}</p>
        )}

        {body ? (
          <>
            <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
              {isOpen ? body : preview}
            </p>
            {isTruncated && (
              <button
                type="button"
                onClick={() => setIsOpen((open) => !open)}
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
              >
                {isOpen ? (
                  <ChevronDown className="size-3" aria-hidden="true" />
                ) : (
                  <ChevronRight className="size-3" aria-hidden="true" />
                )}
                {isOpen ? 'Show less' : 'Show more'}
              </button>
            )}
          </>
        ) : (
          <p className="mt-1.5 text-sm italic text-slate-400">No text content.</p>
        )}

        {mine.length > 0 && (
          <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2">
            {mine.map((file) => (
              <li key={file.id} className="flex items-center gap-1.5 text-xs">
                <Paperclip className="size-3 shrink-0 text-slate-400" aria-hidden="true" />
                {/* `downloadUrl` is null until the bytes are actually on disk —
                    the queue fetches them after the message is safely stored —
                    so the server decides what is downloadable, not this
                    component guessing from a status string. */}
                {file.downloadUrl ? (
                  <a
                    href={file.downloadUrl}
                    className="inline-flex min-w-0 items-center gap-1 truncate font-medium text-brand-600 hover:underline"
                  >
                    <span className="truncate">{file.fileName}</span>
                    <Download className="size-3 shrink-0" aria-hidden="true" />
                  </a>
                ) : (
                  <span className="min-w-0 truncate text-slate-500" title={file.downloadError ?? ''}>
                    {file.fileName}
                    <span className="ml-1 text-slate-400">
                      ({file.downloadStatus === 'blocked' ? 'blocked' : 'pending'})
                    </span>
                  </span>
                )}
                {formatBytes(file.size) && (
                  <span className="shrink-0 text-slate-400">{formatBytes(file.size)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  )
}

/**
 * @param {{
 *   messages?: object[],
 *   attachments?: object[],
 *   lead?: ?object,
 *   isLoading?: boolean,
 * }} props
 */
export function LeadConversation({ messages = [], attachments = [], lead, isLoading = false }) {
  if (isLoading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5" aria-busy="true">
        <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
        <div className="mt-4 space-y-3">
          <div className="h-16 w-3/4 animate-pulse rounded-xl bg-slate-100" />
          <div className="ml-auto h-16 w-3/4 animate-pulse rounded-xl bg-slate-100" />
        </div>
      </section>
    )
  }

  const replyCount = lead?.replyCount ?? 0

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <Mail className="size-4 text-slate-400" aria-hidden="true" />
          Conversation
        </h2>

        <div className="flex items-center gap-2 text-xs">
          {replyCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">
              <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-500">
              Awaiting a reply
            </span>
          )}
          {lead?.lastReplyAt && (
            <span className="text-slate-400">last {formatDateTime(lead.lastReplyAt)}</span>
          )}
        </div>
      </header>

      {messages.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center">
          <MailQuestion className="mx-auto size-6 text-slate-300" aria-hidden="true" />
          <p className="mt-2 text-sm text-slate-500">
            Nothing has been exchanged on this enquiry yet.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {/* The distinction matters: "we never wrote" is a different problem
                from "we wrote and they have not answered". */}
            {lead?.autoMailStatus === 'sent'
              ? 'The introduction was sent. Replies appear here automatically.'
              : 'The introduction has not been sent yet.'}
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {messages.map((message) => (
            <Message key={message.id} message={message} attachments={attachments} />
          ))}
        </ul>
      )}
    </section>
  )
}

export default LeadConversation
