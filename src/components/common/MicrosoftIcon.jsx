/**
 * Microsoft four-square logo.
 *
 * Inlined as SVG rather than fetched, so the sign-in button renders correctly
 * offline and with no extra network request. The four brand colours are fixed
 * values because Microsoft's brand guidelines require the logo to be reproduced
 * exactly — they must not adapt to the app's theme.
 */

/** @param {{ className?: string }} props */
export function MicrosoftIcon({ className = 'size-4' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 21 21"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  )
}

export default MicrosoftIcon
