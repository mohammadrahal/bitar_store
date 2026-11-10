/** Upper bounds for till and payment fields (USD). */
export const MAX_LINE_MONEY = 99_999.99
export const MAX_CASH_TENDERED = 999_999.99
export const MAX_EXCHANGE_RATE_LBP = 50_000_000
/** Whole pounds a customer might hand over at the till. */
export const MAX_LBP_CASH = 9_999_999_999_999

export function clampMoney(value: number, max = MAX_LINE_MONEY): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(max, Math.max(0, Math.round(value * 100) / 100))
}

export function parseMoneyInput(raw: string, max = MAX_LINE_MONEY): number {
  return clampMoney(Number(raw) || 0, max)
}

export function parseLbpInput(raw: string, max = MAX_LBP_CASH): number {
  const n = Number(raw.replace(/[^\d]/g, '')) || 0
  return Math.min(max, Math.max(0, Math.floor(n)))
}

export function clampQuantity(value: number, max = 9999): number {
  if (!Number.isFinite(value)) return 1
  return Math.min(max, Math.max(1, Math.floor(value)))
}

export function clampExchangeRate(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(MAX_EXCHANGE_RATE_LBP, Math.max(1, Math.round(value)))
}
