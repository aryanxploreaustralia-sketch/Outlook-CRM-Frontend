/**
 * Chart colour.
 *
 * Its own file rather than an export from `AdminChart.jsx`, so that module
 * exports components and nothing else — a module mixing components with
 * constants defeats Fast Refresh, and every edit to a chart would remount the
 * page instead of hot-swapping it.
 *
 * ## Validation
 *
 * These five were checked with the data-visualisation palette validator, in this
 * order, against a light chart surface. All checks pass:
 *
 * | Check                 | Result |
 * |-----------------------|--------|
 * | Lightness band        | PASS — all five inside L 0.43–0.77 |
 * | Chroma floor          | PASS — all five ≥ 0.1 |
 * | CVD separation        | PASS — worst adjacent pair ΔE 19.0 (protan) |
 * | Normal-vision floor   | PASS — worst adjacent pair ΔE 27.2 |
 * | Contrast vs surface   | PASS — all five ≥ 3:1 |
 *
 * **The order is the assignment order and is load-bearing.** Slots are handed
 * out in sequence and never cycled: colour follows the entity, so filtering a
 * series out must not repaint the survivors. A reader who learned that enquiries
 * are blue must not find them green after changing a filter.
 *
 * A ninth series is not a generated ninth hue — it folds into "Other", becomes
 * small multiples, or the chart was the wrong form for the question.
 *
 * ## Light only
 *
 * The application ships no dark mode: there is no `dark:` variant and no
 * `prefers-color-scheme` handling anywhere in `styles/index.css`. A dark set is
 * therefore not shipped. When one is needed it must be re-stepped from the same
 * ramps and re-validated against the dark surface — an automatic inversion of
 * these values fails the lightness band, which was confirmed rather than assumed.
 */

export const ADMIN_CHART_COLORS = Object.freeze([
  '#2563eb', // slot 1 — brand blue. The default for a single series.
  '#059669', // slot 2 — emerald
  '#7c3aed', // slot 3 — violet
  '#d97706', // slot 4 — amber
  '#0891b2', // slot 5 — cyan
])

/** The card background the surface gaps and marker rings are cut in. */
export const ADMIN_CHART_SURFACE = '#ffffff'

/** One step off the surface. Solid hairlines only — a dashed rule reads as a threshold. */
export const ADMIN_CHART_GRID = '#e2e8f0'

/** Axis ticks and secondary labels. Text never wears a series colour. */
export const ADMIN_CHART_AXIS_TEXT = '#94a3b8'

/** Direct labels on the marks. */
export const ADMIN_CHART_LABEL_TEXT = '#334155'

export default ADMIN_CHART_COLORS
