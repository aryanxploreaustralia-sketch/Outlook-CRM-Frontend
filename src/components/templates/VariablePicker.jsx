/**
 * The variable picker.
 *
 * Nobody should have to remember whether it is `{{ContactPerson}}` or
 * `{{Contact_Person}}` — a typo there is not caught until a customer receives a
 * message with a literal `{{ContactPersn}}` in it. Clicking inserts the exact
 * token at the cursor.
 *
 * The list comes from the server, so it cannot offer a variable the renderer
 * does not know.
 */

import { Braces } from 'lucide-react'

/**
 * @param {{
 *   variables: Array<{name: string, label: string, description: string, example: string, token: string}>,
 *   onInsert: (token: string) => void,
 *   isDisabled?: boolean,
 * }} props
 */
export function VariablePicker({ variables, onInsert, isDisabled = false }) {
  if (variables.length === 0) return null

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex items-center gap-2">
        <Braces className="size-4 text-slate-400" aria-hidden="true" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Insert a variable
        </h3>
      </div>

      <p className="mt-1 text-xs text-slate-500">
        Replaced with the enquiry&rsquo;s own details when the message is sent. A detail the
        enquiry does not have becomes an empty space, never a visible placeholder.
      </p>

      <ul className="mt-2.5 flex flex-wrap gap-1.5">
        {variables.map((variable) => (
          <li key={variable.name}>
            <button
              type="button"
              onClick={() => onInsert(variable.token)}
              disabled={isDisabled}
              // Both the meaning and a worked example, because "Destination"
              // alone does not tell you it falls back to the market.
              title={`${variable.description}\nExample: ${variable.example}`}
              className="rounded border border-slate-200 bg-white px-2 py-1 font-mono text-xs text-slate-600 transition-colors hover:border-blue-400 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {variable.token}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default VariablePicker
