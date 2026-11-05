import { addDays, toIsoDate } from '@/lib/dates'

/**
 * The presets the overview offers. `/reports/sales-summary` caps a range at 366
 * shop days, so every one of these is well inside what the server will answer.
 */
export const RANGE_PRESETS = [7, 30, 90] as const

export type RangeDays = (typeof RANGE_PRESETS)[number]

export const DEFAULT_RANGE: RangeDays = 30

export interface DateRange {
  from: string
  to: string
}

export function rangeLabel(days: RangeDays) {
  return `${days} days`
}

/** The last `days` shop days, today inclusive. */
export function rangeOf(days: RangeDays, today = new Date()): DateRange {
  return { from: toIsoDate(addDays(today, -(days - 1))), to: toIsoDate(today) }
}

/**
 * The equally long window ending the day before `rangeOf` starts, which is what
 * a delta on a stat tile is measured against. Comparing 30 days to 30 days
 * keeps the two halves like for like.
 */
export function previousRangeOf(days: RangeDays, today = new Date()): DateRange {
  return { from: toIsoDate(addDays(today, -(days * 2 - 1))), to: toIsoDate(addDays(today, -days)) }
}

export interface Delta {
  /** Signed percentage change, rounded to one decimal. */
  percent: number
  direction: 'up' | 'down' | 'flat'
}

/**
 * A like-for-like change, or `null` when there is nothing to compare against.
 * A previous period of zero has no percentage — "up 100%" from nothing is not a
 * fact about the business — so the tile says what it is instead of inventing one.
 */
export function deltaOf(current: number, previous: number): Delta | null {
  if (previous <= 0) return null
  const percent = Math.round(((current - previous) / previous) * 1000) / 10
  if (percent === 0) return { percent, direction: 'flat' }
  return { percent, direction: percent > 0 ? 'up' : 'down' }
}

export function formatDelta(delta: Delta) {
  const sign = delta.percent > 0 ? '+' : ''
  return `${sign}${delta.percent}%`
}
