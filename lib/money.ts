/*
 * Till arithmetic. Prices arrive as decimal amounts; every sum is done in whole
 * cents so a split payment never fails on a float.
 */

export function toCents(value: number) {
  return Math.round(value * 100)
}

export function fromCents(cents: number) {
  return cents / 100
}

/** A line as the till holds it, before the server prices it for real. */
export interface SaleLineAmount {
  quantity: number
  unitPrice: number
  /** Percentage off this line, as the API takes it. */
  discountPercent?: number
}

export function lineTotal(line: SaleLineAmount) {
  const gross = line.quantity * toCents(line.unitPrice)
  const off = Math.round((gross * Math.min(Math.max(line.discountPercent ?? 0, 0), 100)) / 100)
  return fromCents(gross - off)
}

/** What the sale comes to on screen. The server's answer is what is recorded. */
export function saleTotal(lines: readonly SaleLineAmount[]) {
  return fromCents(lines.reduce((sum, line) => sum + toCents(lineTotal(line)), 0))
}
