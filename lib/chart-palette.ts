/**
 * Chart series colours, as CSS variables so light and dark swap in one place.
 *
 * The order is fixed and assigned in sequence — it is what keeps adjacent
 * segments apart under colour blindness, so it is never shuffled or cycled.
 * Both modes were checked with the data-viz validator (OKLab ΔE ×100):
 *
 *   light  #B5832A #009E96 #4A57A8 #CF6E85 #6F8B2F
 *          worst adjacent CVD ΔE 9.6 · normal-vision ΔE 18.8 · all >= 3:1
 *   dark   #B98927 #19A3B3 #5265A8 #BF4059 #8C9B4C
 *          worst adjacent CVD ΔE 10.5 · normal-vision ΔE 17.5 · all >= 3:1
 *
 * Re-run the validator before changing any value, and keep the count at five:
 * a sixth hue would be a generated one, which is indistinguishable under CVD.
 * Longer tails fold into the neutral "Other" series instead.
 */
const SERIES_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
] as const

export const OTHER_SERIES_ID = 'other'
const OTHER_COLOR = 'var(--chart-other)'

export const CHART_SURFACE = 'var(--chart-surface)'
export const CHART_GRID = 'var(--chart-grid)'
export const CHART_TEXT = 'var(--chart-text)'

/** The 2px of surface that separates touching marks, per the mark spec. */
export const MARK_GAP = 2
export const MARK_THICKNESS = 18
export const MARK_RADIUS = 4

/** Colour follows the series' position in the fixed order, never its rank. */
export function seriesColor(seriesId: string, index: number) {
  if (seriesId === OTHER_SERIES_ID) return OTHER_COLOR
  return SERIES_COLORS[index % SERIES_COLORS.length]
}
