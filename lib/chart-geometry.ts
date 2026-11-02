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

/**
 * The height each dashboard chart lays out to, as a function of its row count.
 * Lives here rather than in the chart components because the placeholder shown
 * while recharts loads has to reserve the exact same height, and must not pull
 * recharts into the first load to find out what it is.
 */
export const TOP_SELLERS_ROW_HEIGHT = 34
export const BRANCH_SALES_ROW_HEIGHT = 44
const CHART_AXIS_HEIGHT = 48

export function topSellersChartHeight(rowCount: number) {
  return Math.max(rowCount * TOP_SELLERS_ROW_HEIGHT + CHART_AXIS_HEIGHT, 200)
}

export function branchSalesChartHeight(rowCount: number) {
  return Math.max(rowCount * BRANCH_SALES_ROW_HEIGHT + CHART_AXIS_HEIGHT, 180)
}

/** The trend plots a fixed window, so its height does not follow the data. */
export const REVENUE_TREND_HEIGHT = 260
