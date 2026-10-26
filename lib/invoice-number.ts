import type { InvoiceKind } from '@/types'

const SERIES: Record<InvoiceKind, string> = {
  sale: 'SAL',
  purchase: 'PUR',
  sale_return: 'SRT',
  purchase_return: 'PRT',
  /* Both directions share one series: an adjustment is one kind of event. */
  adjustment_in: 'ADJ',
  adjustment_out: 'ADJ',
}

/** Transfer legs share one series, so a move reads as a single operation. */
const INTERNAL_SERIES = 'TRF'

export function seriesFor(kind: InvoiceKind, isInternal: boolean) {
  return isInternal ? INTERNAL_SERIES : SERIES[kind]
}

/**
 * Next number in a per-series, per-year sequence: SAL-2026-0001. Derived from
 * the numbers already stored rather than a counter, so it survives a reseed.
 */
export function nextInvoiceNumber(series: string, issuedAt: Date, existing: readonly string[]) {
  const prefix = `${series}-${issuedAt.getFullYear()}-`
  const highest = existing
    .filter((number) => number.startsWith(prefix))
    .reduce((max, number) => Math.max(max, Number.parseInt(number.slice(prefix.length), 10) || 0), 0)
  return `${prefix}${String(highest + 1).padStart(4, '0')}`
}
