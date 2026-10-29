import type { Balances } from '@/types'

/**
 * A total only claims a figure the rows could actually report. Reserved and on
 * hold stay null while the API cannot answer them, so a column of "not
 * available yet" never adds up to a confident zero.
 */
function sumOptional(rows: Balances[], key: 'reserved' | 'onHold'): number | null {
  const known = rows.map((row) => row[key]).filter((value): value is number => value !== null)
  return known.length === 0 ? null : known.reduce((sum, value) => sum + value, 0)
}

export function sumBalances(rows: Balances[]): Balances {
  return {
    onHand: rows.reduce((sum, row) => sum + row.onHand, 0),
    nonSellable: rows.reduce((sum, row) => sum + row.nonSellable, 0),
    reserved: sumOptional(rows, 'reserved'),
    onHold: sumOptional(rows, 'onHold'),
    available: rows.reduce((sum, row) => sum + row.available, 0),
    inTransit: rows.reduce((sum, row) => sum + row.inTransit, 0),
  }
}

/** Shown wherever the API has no number to give. */
export const NOT_AVAILABLE_YET = '—'

export function balanceText(value: number | null, format: (value: number) => string): string {
  return value === null ? NOT_AVAILABLE_YET : format(value)
}
