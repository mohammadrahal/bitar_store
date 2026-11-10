import type { ApiCashSessionSummary, ApiCashSessionTotals } from '@/lib/api/types'

export const EMPTY_CASH_SESSION_TOTALS: ApiCashSessionTotals = {
  salesCount: 0,
  salesTotal: '0.00',
  cashPayments: '0.00',
  whishPayments: '0.00',
  cashIn: '0.00',
  cashOut: '0.00',
  expectedCash: '0.00',
}

export function cashSessionListTotalsMissing(session: ApiCashSessionSummary): boolean {
  return session.totals == null
}

/** Some list payloads omit totals; the UI still shows the shift and reads 0 until detail loads. */
export function cashSessionTotals(session: ApiCashSessionSummary): ApiCashSessionTotals {
  return session.totals ?? EMPTY_CASH_SESSION_TOTALS
}

export function cashSessionListItems(items: ApiCashSessionSummary[] | undefined): ApiCashSessionSummary[] {
  return (items ?? []).filter((row) => Boolean(row?.id))
}

/** Short shift label for UI (not a server reference). */
export function shiftDisplayRef(sessionId: string): string {
  const tail = sessionId.replace(/-/g, '').slice(-6).toUpperCase()
  return `Shift #${tail}`
}

export function cashSessionHref(sessionId: string): string {
  return `/cash/${sessionId}`
}

export function actorName(actor?: { id?: string; name?: string | null } | null): string {
  if (!actor) return 'Unknown'
  const name = actor.name?.trim()
  return name || 'Unknown'
}

export function shiftElapsed(openedAt: string, now = Date.now()): string {
  const ms = Math.max(0, now - new Date(openedAt).getTime())
  const hours = Math.floor(ms / 3_600_000)
  const minutes = Math.floor((ms % 3_600_000) / 60_000)
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${minutes}m`
}
