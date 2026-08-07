/**
 * Labelled form controls.
 *
 * Three exports sharing one label/hint/error frame, because the alternative is
 * each form re-deriving the association between a label, its control, its help
 * text and its error — and getting one of them wrong silently, since nothing
 * visually breaks when `aria-describedby` is missing.
 *
 * What the frame guarantees:
 *
 *  - a real `<label htmlFor>`, so clicking the label focuses the control and a
 *    screen reader announces the two together;
 *  - `aria-invalid` and `aria-describedby` wired to the error, so the failure is
 *    announced rather than only drawn in red;
 *  - `role="alert"` on the error, so it is announced when it appears rather than
 *    only when the field is next focused;
 *  - the error replacing the hint rather than stacking, so the field does not
 *    change height as the user types and push the submit button around.
 */

import { useId } from 'react'

const CONTROL =
  'w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500'

const TONE = {
  normal: 'border-slate-300 focus:border-brand-500 focus:ring-brand-500/20',
  invalid: 'border-red-400 focus:border-red-500 focus:ring-red-500/20',
}

/** The shared label / control / message wrapper. */
function Frame({ id, label, hint, error, required, children }) {
  const messageId = `${id}-message`

  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-slate-700">
        {label}
        {required && (
          <span className="ml-0.5 text-red-500" aria-hidden="true">
            *
          </span>
        )}
        {/* The asterisk is decoration; `required` on the control is what
            assistive technology actually reads. Spelled out for anyone who
            cannot see the glyph. */}
        {required && <span className="sr-only"> (required)</span>}
      </label>

      <div className="mt-1">{children(messageId)}</div>

      {/* One slot, so the field never changes height between states. */}
      <div className="mt-1 min-h-4">
        {error ? (
          <p id={messageId} role="alert" className="text-xs text-red-600">
            {error}
          </p>
        ) : hint ? (
          <p id={messageId} className="text-xs text-slate-400">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  )
}

/**
 * @param {{
 *   label: string, value: string, onChange: (next: string) => void,
 *   type?: string, placeholder?: string, hint?: string, error?: ?string,
 *   required?: boolean, disabled?: boolean, autoFocus?: boolean,
 *   autoComplete?: string,
 * }} props
 */
export function AdminTextField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  hint,
  error,
  required = false,
  disabled = false,
  autoFocus = false,
  autoComplete,
}) {
  const id = useId()

  return (
    <Frame id={id} label={label} hint={hint} error={error} required={required}>
      {(messageId) => (
        <input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoFocus={autoFocus}
          autoComplete={autoComplete}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={hint || error ? messageId : undefined}
          className={`${CONTROL} ${error ? TONE.invalid : TONE.normal}`}
        />
      )}
    </Frame>
  )
}

/**
 * @param {{
 *   label: string, value: string, onChange: (next: string) => void,
 *   options: Array<{ value: string, label: string }>,
 *   placeholder?: string, hint?: string, error?: ?string,
 *   required?: boolean, disabled?: boolean,
 * }} props
 */
export function AdminSelectField({
  label,
  value,
  onChange,
  options,
  placeholder = 'Choose…',
  hint,
  error,
  required = false,
  disabled = false,
}) {
  const id = useId()

  return (
    <Frame id={id} label={label} hint={hint} error={error} required={required}>
      {(messageId) => (
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          disabled={disabled}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={hint || error ? messageId : undefined}
          className={`${CONTROL} ${error ? TONE.invalid : TONE.normal} ${value ? '' : 'text-slate-400'}`}
        >
          {/* Empty and disabled, so "choose" cannot be submitted as a value —
              which matters most on the role field, where a silent default
              would be the wrong role rather than no role. */}
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              /**
               * Per-option `disabled`, added in Phase 14.8A and optional —
               * every existing caller omits it and is unaffected.
               *
               * The role selector needs an option that is *visible but
               * unselectable*: an admin who cannot see "Owner" learns nothing,
               * while one who sees it greyed out with the reason has learned
               * how the system works. Filtering it out instead would hide the
               * rule along with the option.
               */
              disabled={option.disabled ?? false}
              className={option.disabled ? 'text-slate-400' : 'text-slate-800'}
            >
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Frame>
  )
}

/**
 * @param {{
 *   label: string, value: string, onChange: (next: string) => void,
 *   rows?: number, placeholder?: string, hint?: string, error?: ?string,
 *   maxLength?: number, disabled?: boolean,
 * }} props
 */
export function AdminTextArea({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
  hint,
  error,
  maxLength,
  disabled = false,
}) {
  const id = useId()

  // A live count only where there is a limit to run into. Shown as remaining
  // rather than used, because the number the writer needs is how much is left.
  const remaining = maxLength ? maxLength - value.length : null

  return (
    <Frame
      id={id}
      label={label}
      hint={remaining !== null && remaining < 80 ? `${remaining} characters remaining` : hint}
      error={error}
    >
      {(messageId) => (
        <textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={rows}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={hint || error ? messageId : undefined}
          className={`${CONTROL} resize-none ${error ? TONE.invalid : TONE.normal}`}
        />
      )}
    </Frame>
  )
}

export default AdminTextField
