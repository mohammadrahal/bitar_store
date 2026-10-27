import type { InvoiceLine, InvoiceTotals } from '@/types'

/** A line as the form holds it, before the catalog snapshot is taken. */
export interface TotalsLine {
  quantity: number
  unitPrice: number
  unitCost?: number
}

/** Prices arrive as decimal amounts; every sum below is done in whole cents so floats never drift. */
export function toCents(value: number) {
  return Math.round(value * 100)
}

export function fromCents(cents: number) {
  return cents / 100
}

function lineCents(quantity: number, unitPrice: number) {
  return quantity * toCents(unitPrice)
}

export function lineTotal(line: TotalsLine) {
  return fromCents(lineCents(line.quantity, line.unitPrice))
}

export function invoiceTotals(lines: readonly TotalsLine[], discount = 0): InvoiceTotals {
  const subtotal = lines.reduce((sum, line) => sum + lineCents(line.quantity, line.unitPrice), 0)
  const cost = lines.reduce((sum, line) => sum + lineCents(line.quantity, line.unitCost ?? 0), 0)
  const units = lines.reduce((sum, line) => sum + line.quantity, 0)
  // A discount never turns a document negative, whatever the form was holding.
  const applied = Math.min(Math.max(toCents(discount), 0), subtotal)
  const total = subtotal - applied

  return {
    subtotal: fromCents(subtotal),
    discount: fromCents(applied),
    total: fromCents(total),
    cost: fromCents(cost),
    margin: fromCents(total - cost),
    units,
  }
}

export function totalsOfLines(lines: readonly InvoiceLine[], discount = 0) {
  return invoiceTotals(lines, discount)
}
