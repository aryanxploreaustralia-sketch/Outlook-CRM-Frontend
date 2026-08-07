/**
 * The dashboard's in-page section navigation.
 *
 * These are sections of one page, not routes — so this renders **buttons**, not
 * links. A `<Link>` here would push a history entry per click, and Back would
 * then walk the reader up through nine sections before returning them to the
 * directory, which is exactly the navigation this phase exists to fix.
 *
 * ## Two shapes, one component
 *
 * On desktop it is a sticky rail beside the content. On narrow viewports a
 * 200px column would leave nothing for the content, so it becomes a horizontal
 * scroller above it — same markup, same state, different positioning.
 *
 * `aria-current="true"` rather than `"page"`: the reader has not navigated to a
 * page, they have scrolled to a region of one.
 */

/**
 * @param {{
 *   sections: Array<{ id: string, label: string }>,
 *   activeId: string,
 *   onSelect: (id: string) => void,
 * }} props
 */
export function UserSectionNav({ sections, activeId, onSelect }) {
  return (
    <nav
      aria-label="User sections"
      className="lg:sticky lg:top-0 lg:w-52 lg:shrink-0 lg:self-start"
    >
      {/*
        `-mx-4 px-4` on mobile lets the scroller bleed to the screen edges, so
        the last item does not look clipped by the page gutter.
      */}
      <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
        {sections.map((section) => {
          const isActive = section.id === activeId

          return (
            <li key={section.id} className="shrink-0 lg:shrink">
              <button
                type="button"
                onClick={() => onSelect(section.id)}
                aria-current={isActive ? 'true' : undefined}
                className={`relative w-full whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-800'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {/* A second, non-colour cue for the active row — the same rail
                    the sidebar navigation uses. Desktop only: on the horizontal
                    scroller a left rail would read as a separator. */}
                <span
                  className={`absolute left-0 top-1/2 hidden h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-brand-600 transition-opacity lg:block ${
                    isActive ? 'opacity-100' : 'opacity-0'
                  }`}
                  aria-hidden="true"
                />
                {section.label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export default UserSectionNav
