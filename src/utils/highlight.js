/**
 * Splits a string around the match so it can be highlighted.
 *
 * Returns parts rather than HTML: building a `<mark>` by string concatenation
 * would mean injecting user-controlled text as markup, and the one place that
 * is guaranteed to contain hostile input is a search box.
 */
export function highlightParts(text, term) {
  if (!text || !term) return [{ text: text ?? '', match: false }]

  const haystack = String(text)
  const index = haystack.toLowerCase().indexOf(term.toLowerCase())

  if (index === -1) return [{ text: haystack, match: false }]

  return [
    { text: haystack.slice(0, index), match: false },
    { text: haystack.slice(index, index + term.length), match: true },
    { text: haystack.slice(index + term.length), match: false },
  ].filter((part) => part.text.length > 0)
}

export default highlightParts
