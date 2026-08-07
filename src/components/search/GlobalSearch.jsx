/**
 * The command palette.
 *
 * ## Nothing here filters
 *
 * The server returns only what this person may read — a source they lack is
 * never queried — so results are rendered as they arrive. Filtering in the
 * browser would be redundant at best and misleading at worst: it can only hide
 * what has already been sent to the client.
 *
 * ## The 300ms debounce is about the database, not the network
 *
 * Each search fans out to nine indexed queries. Typing "enquiry" unthrottled is
 * seven searches and sixty-three queries for one answer. The debounce collapses
 * that to one, and an in-flight request is aborted when a newer one starts —
 * without that, a slow early response can land after a fast later one and
 * replace correct results with stale ones.
 *
 * ## Keyboard first
 *
 * `Ctrl/⌘+K` or `/` opens it, arrows move, Enter opens, Escape closes. `/` is
 * ignored while the reader is typing in an input, or it would be impossible to
 * type a slash anywhere in the application.
 *
 * ## Recent and pinned searches are local
 *
 * They live in `localStorage`, not on the server. A search history is a record
 * of what somebody was looking for — often the most sensitive thing about their
 * session — and there is no reason for it to leave the machine to make a
 * dropdown work.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Bell,
  Building2,
  Clock,
  FileClock,
  FileText,
  Inbox,
  Loader2,
  Megaphone,
  Pin,
  PinOff,
  Search,
  Target,
  Users,
  X,
} from 'lucide-react'

import { globalSearch } from '@/api/services/search.service'
import { highlightParts } from '@/utils/highlight'

/** Server icon key → component. Unknown keys fall back rather than crash. */
const ICONS = {
  users: Users,
  building: Building2,
  'building-2': Building2,
  target: Target,
  megaphone: Megaphone,
  inbox: Inbox,
  'file-text': FileText,
  'file-clock': FileClock,
  bell: Bell,
}

const DEBOUNCE_MS = 300
const RECENT_KEY = 'oa.search.recent'
const PINNED_KEY = 'oa.search.pinned'
const MAX_RECENT = 6

/** localStorage that cannot throw — Safari private mode refuses to write. */
function readList(key) {
  try {
    const raw = window.localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeList(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value.slice(0, 20)))
  } catch {
    // A full or disabled store costs the convenience, not the feature.
  }
}

function Highlight({ text, term }) {
  return (
    <>
      {highlightParts(text, term).map((part, index) =>
        part.match ? (
          <mark key={index} className="rounded bg-amber-100 px-0.5 text-slate-900">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  )
}

export function GlobalSearch({ isOpen, onClose }) {
  const navigate = useNavigate()

  const [term, setTerm] = useState('')
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const [recent, setRecent] = useState(() => readList(RECENT_KEY))
  const [pinned, setPinned] = useState(() => readList(PINNED_KEY))

  const inputRef = useRef(null)
  const listRef = useRef(null)
  const controllerRef = useRef(null)

  /** Every result in render order, so arrow keys cross group boundaries. */
  const flat = useMemo(
    () => (data?.groups ?? []).flatMap((group) => group.results.map((r) => ({ ...r, group: group.label }))),
    [data],
  )

  // --- the search ------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) return undefined

    const trimmed = term.trim()

    if (trimmed.length < 2) {
      setData(null)
      setError(null)
      setIsLoading(false)
      return undefined
    }

    setIsLoading(true)

    const timer = setTimeout(async () => {
      // Abort the previous request so a slow early response cannot land after a
      // fast later one and overwrite it.
      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller

      try {
        const result = await globalSearch({ q: trimmed, signal: controller.signal })
        setData(result)
        setError(null)
        setActiveIndex(0)
      } catch (caught) {
        if (caught?.isCanceled) return
        setError(caught?.message ?? 'Search could not be completed.')
        setData(null)
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [term, isOpen])

  // --- open / close ----------------------------------------------------------
  useEffect(() => {
    if (isOpen) {
      // A frame's delay: the input does not exist until this render commits.
      const raf = requestAnimationFrame(() => inputRef.current?.focus())
      return () => cancelAnimationFrame(raf)
    }

    setTerm('')
    setData(null)
    setError(null)
    setActiveIndex(0)
    controllerRef.current?.abort()
    return undefined
  }, [isOpen])

  const remember = useCallback((value) => {
    const next = [value, ...readList(RECENT_KEY).filter((entry) => entry !== value)].slice(0, MAX_RECENT)
    setRecent(next)
    writeList(RECENT_KEY, next)
  }, [])

  const open = useCallback(
    (result) => {
      if (!result?.url) return
      remember(term.trim())
      onClose()
      navigate(result.url)
    },
    [navigate, onClose, remember, term],
  )

  const togglePin = useCallback((value) => {
    const current = readList(PINNED_KEY)
    const next = current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [value, ...current].slice(0, 8)

    setPinned(next)
    writeList(PINNED_KEY, next)
  }, [])

  // --- keyboard --------------------------------------------------------------
  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((previous) => (flat.length === 0 ? 0 : (previous + 1) % flat.length))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((previous) => (flat.length === 0 ? 0 : (previous - 1 + flat.length) % flat.length))
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      open(flat[activeIndex])
    }
  }

  /** Keeps the highlighted row in view when the arrows walk past the fold. */
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (!isOpen) return null

  const showSuggestions = term.trim().length < 2
  const suggestions = [...pinned.map((v) => ({ value: v, pinned: true })), ...recent.filter((v) => !pinned.includes(v)).map((v) => ({ value: v, pinned: false }))]

  let cursor = -1

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative flex max-h-[70vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl animate-in fade-in slide-in-from-top-2">
        {/* --- Input --------------------------------------------------- */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-4">
          {isLoading ? (
            <Loader2 className="size-4 shrink-0 animate-spin text-brand-500" aria-hidden="true" />
          ) : (
            <Search className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
          )}

          <input
            ref={inputRef}
            type="text"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search users, enquiries, campaigns, mailboxes…"
            aria-label="Search"
            className="h-14 flex-1 border-0 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400"
          />

          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {/* --- Body --------------------------------------------------- */}
        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
          {error && (
            <p role="alert" className="px-4 py-6 text-sm text-red-700">
              {error}
            </p>
          )}

          {!error && showSuggestions && (
            <div className="p-2">
              {suggestions.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-slate-400">
                  Type at least two characters to search.
                </p>
              ) : (
                <>
                  <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                    Recent and pinned
                  </p>
                  {suggestions.map((entry) => (
                    <div key={entry.value} className="group flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setTerm(entry.value)}
                        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                      >
                        {entry.pinned ? (
                          <Pin className="size-3.5 shrink-0 text-brand-500" aria-hidden="true" />
                        ) : (
                          <Clock className="size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                        )}
                        <span className="truncate">{entry.value}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => togglePin(entry.value)}
                        aria-label={entry.pinned ? 'Unpin this search' : 'Pin this search'}
                        className="rounded p-1.5 text-slate-300 opacity-0 transition-opacity hover:text-brand-600 focus:opacity-100 group-hover:opacity-100"
                      >
                        {entry.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {!error && !showSuggestions && data && flat.length === 0 && !isLoading && (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-slate-600">
                Nothing matches &ldquo;{term.trim()}&rdquo;.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Try part of a name, an email address or an enquiry reference.
              </p>
            </div>
          )}

          {!error && !showSuggestions && data && flat.length > 0 && (
            <div className="p-2">
              {data.groups.map((group) => {
                const Icon = ICONS[group.icon] ?? Search

                return (
                  <section key={group.key} className="mb-1">
                    <p className="px-3 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                      {group.label}
                    </p>

                    {/* A source that failed is shown as such — silence would
                        read as "there were no matches here". */}
                    {!group.available && (
                      <p className="px-3 pb-2 text-xs text-amber-700">{group.reason}</p>
                    )}

                    {group.results.map((result) => {
                      cursor += 1
                      const index = cursor
                      const isActive = index === activeIndex

                      return (
                        <button
                          key={`${group.key}-${result.id}`}
                          type="button"
                          data-index={index}
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => open(result)}
                          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                            isActive ? 'bg-brand-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <Icon className="size-4 shrink-0 text-slate-400" aria-hidden="true" />

                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-slate-900">
                              <Highlight text={result.title} term={term.trim()} />
                            </span>
                            {result.subtitle && (
                              <span className="block truncate text-xs text-slate-500">
                                <Highlight text={result.subtitle} term={term.trim()} />
                              </span>
                            )}
                          </span>

                          {result.badge && (
                            <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                              {result.badge}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </section>
                )
              })}
            </div>
          )}
        </div>

        {/* --- Footer -------------------------------------------------- */}
        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-2 text-xs text-slate-400">
          <span className="flex gap-3">
            <span>↑↓ navigate</span>
            <span>↵ open</span>
            <span>esc close</span>
          </span>

          {/* Honest about scope: a reader who cannot search the audit log
              should know their search did not cover it. */}
          {data?.skipped?.length > 0 && (
            <span>{data.skipped.length} source(s) not searched — permission</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default GlobalSearch
