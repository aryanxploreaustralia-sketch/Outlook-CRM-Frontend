/**
 * Search input.
 *
 * Three details are handled here so no page has to remember them:
 *
 *  1. **A real `<label>`,** visually hidden. A placeholder is not a label — it
 *     disappears the moment the user types, and screen readers do not reliably
 *     announce it.
 *  2. **`type="search"`,** which gives mobile keyboards a Search key and lets
 *     the browser offer its own clear affordance.
 *  3. **A clear button that only exists when there is something to clear,** and
 *     which returns focus to the input. A clear button that blurs the field
 *     makes the user click twice to carry on typing.
 *
 * Controlled by design. Debouncing belongs to the page — it is the page that
 * knows whether the value drives a network request or a local `filter()`.
 */

import { useId, useRef } from 'react'
import { Search, X } from 'lucide-react'

/**
 * @param {{
 *   value: string,
 *   onChange: (next: string) => void,
 *   placeholder?: string,
 *   label?: string,
 *   disabled?: boolean,
 *   className?: string,
 * }} props
 */
export function AdminSearch({
  value,
  onChange,
  placeholder = 'Search…',
  label = 'Search',
  disabled = false,
  className = '',
}) {
  const inputId = useId()
  const inputRef = useRef(null)

  const handleClear = () => {
    onChange('')
    inputRef.current?.focus()
  }

  return (
    <div className={`relative ${className}`}>
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>

      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />

      <input
        ref={inputRef}
        id={inputId}
        type="search"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm text-slate-800 placeholder:text-slate-400 transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
      />

      {value && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

export default AdminSearch
