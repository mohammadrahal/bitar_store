const currencyFormatters = new Map<string, Intl.NumberFormat>()

export function formatCurrency(value: number, currency: string, compact = false) {
  const key = `${currency}-${compact}`
  let formatter = currencyFormatters.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: compact ? 1 : 0,
      notation: compact ? 'compact' : 'standard',
    })
    currencyFormatters.set(key, formatter)
  }
  return formatter.format(value)
}

const numberFormatter = new Intl.NumberFormat('en-US')

export function formatNumber(value: number) {
  return numberFormatter.format(value)
}

/** Notification and nav badges: cap at 9+ per product spec. */
export function formatBadgeCount(value: number) {
  if (value > 9) return '9+'
  return formatNumber(value)
}

export function formatSigned(value: number) {
  return value > 0 ? `+${formatNumber(value)}` : formatNumber(value)
}

const timeFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })
const dateTimeFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const shortDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit' })
const longDateFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function formatRelativeDateTime(iso: string, now = new Date()) {
  const date = new Date(iso)
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)
  if (diffDays === 0) return `Today, ${timeFormatter.format(date)}`
  if (diffDays === 1) return `Yesterday, ${timeFormatter.format(date)}`
  return dateTimeFormatter.format(date)
}

export function formatShortDate(date: Date) {
  return shortDateFormatter.format(date)
}

export function formatLongDate(date: Date) {
  return longDateFormatter.format(date)
}

export const CURRENCY = 'USD'

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatPrice(value: number) {
  return priceFormatter.format(value)
}

const lbpFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** Lebanese pounds — whole numbers, no currency symbol in the formatter. */
export function formatLbp(value: number) {
  return `${lbpFormatter.format(Math.round(value))} LBP`
}

/** Up to two initials for an avatar: "Nadia Bitar" -> "NB". */
export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

const documentDateFormatter = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: '2-digit' })

/** Dated documents always carry their year, unlike the dashboard's short dates. */
export function formatDocumentDate(iso: string) {
  return documentDateFormatter.format(new Date(iso))
}

/**
 * A `yyyy-mm-dd` the user typed, which is a calendar date and not an instant.
 *
 * `new Date('2026-11-03')` is parsed as UTC midnight, so west of Greenwich it
 * formats as the 2nd — the date on a document would be shown as the day before
 * the one that is printed on it. Reading the parts and building a local date
 * keeps the day the person entered.
 */
export function formatDateInput(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  return documentDateFormatter.format(new Date(year, month - 1, day))
}

const settingsDateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

/** Settings footnotes, e.g. "3 Nov 2026, 10:42". */
export function formatSettingsDateTime(iso: string) {
  return settingsDateTimeFormatter.format(new Date(iso))
}

/** Large currency display: `1 USD = 89,500 LBP`. */
export function formatUsdLbpRate(usdToLbp: number) {
  return `1 USD = ${numberFormatter.format(Math.round(usdToLbp))} LBP`
}

/** `yyyy-MM-dd` for a date input, in local time so "today" is the user's today. */
export function toDateInput(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function todayAsDateInput() {
  return toDateInput(new Date())
}
