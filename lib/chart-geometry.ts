import { MARK_RADIUS } from '@/lib/chart-palette'

/**
 * A rectangle rounded on its right edge only: the data-end of a horizontal
 * bar, square where it meets the baseline. Kept out of the component so the
 * path maths can be checked on its own.
 */
export function roundedRightRect(x: number, y: number, width: number, height: number) {
  const r = Math.min(MARK_RADIUS, width, height / 2)
  return [
    `M${x},${y}`,
    `H${x + width - r}`,
    `Q${x + width},${y} ${x + width},${y + r}`,
    `V${y + height - r}`,
    `Q${x + width},${y + height} ${x + width - r},${y + height}`,
    `H${x}`,
    'Z',
  ].join(' ')
}

/** A plain rectangle, for the segments that are not a row's data-end. */
export function squareRect(x: number, y: number, width: number, height: number) {
  return `M${x},${y}h${width}v${height}h${-width}Z`
}

/** The series a row ends on: the segment that rounds and carries the total. */
export function outermostSeries(seriesIds: readonly string[], row: Record<string, unknown>) {
  for (let index = seriesIds.length - 1; index >= 0; index -= 1) {
    const id = seriesIds[index]
    const value = row[id]
    if (typeof value === 'number' && value > 0) return id
  }
  return ''
}
