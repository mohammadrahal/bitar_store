import type { InvoiceLine, InvoiceTotals } from '@/types'

/** A line as the form holds it, before the catalog snapshot is taken. */
export interface TotalsLine {
  quantity: number
  unitPrice: number
  unitCost?: number
}

/** Rounds to cents, so repeated edits cannot drift into fractions of a cent. */
function money(value: number) {
  return Math.round(value * 100) / 100
}

export function lineTotal(line: TotalsLine) {
  return money(line.quantity * line.unitPrice)
}

export function invoiceTotals(lines: readonly TotalsLine[], discount = 0): InvoiceTotals {
  const subtotal = money(lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0))
  const cost = money(lines.reduce((sum, line) => sum + line.quantity * (line.unitCost ?? 0), 0))
  const units = lines.reduce((sum, line) => sum + line.quantity, 0)
  // A discount never turns a document negative, whatever the form was holding.
  const applied = money(Math.min(Math.max(discount, 0), subtotal))
  const total = money(subtotal - applied)

  return { subtotal, discount: applied, total, cost, margin: money(total - cost), units }
}

export function totalsOfLines(lines: readonly InvoiceLine[], discount = 0) {
  return invoiceTotals(lines, discount)
}
