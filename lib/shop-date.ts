/** Shop days are the Lebanese calendar day, which is what sales history and reports filter on. */
const SHOP_TIME_ZONE = 'Asia/Beirut'

export type SalesHistoryPreset = 'today' | 'yesterday' | 'last7' | 'month' | 'year' | 'custom'

/** `YYYY-MM-DD` in Beirut, independent of the browser's timezone. */
export function shopToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SHOP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function shiftShopDate(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Inclusive day count. The sales history endpoint refuses a span over 366 days. */
export function shopSpanDays(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0
  return Math.round((end - start) / 86_400_000) + 1
}

export function presetRange(preset: Exclude<SalesHistoryPreset, 'custom'>, today = shopToday()) {
  if (preset === 'today') return { from: today, to: today }
  if (preset === 'yesterday') {
    const day = shiftShopDate(today, -1)
    return { from: day, to: day }
  }
  if (preset === 'last7') return { from: shiftShopDate(today, -6), to: today }
  if (preset === 'month') return { from: `${today.slice(0, 8)}01`, to: today }
  return { from: shiftShopDate(today, -364), to: today }
}
