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

export type DateLike = string | number | Date | null | undefined

/**
 * `Intl.DateTimeFormat#format` throws `RangeError: Invalid time value` on an
 * invalid Date, which takes down the whole page. API rows can carry a null or
 * unparseable timestamp, so every formatter goes through this first.
 */
export function toValidDate(value: DateLike): Date | null {
  if (value === null || value === undefined || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function startOfDay(date: Date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function formatRelativeDateTime(iso: DateLike, now = new Date()) {
  const date = toValidDate(iso)
  if (!date) return EMPTY_DISPLAY
  const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)
  if (diffDays === 0) return `Today, ${timeFormatter.format(date)}`
  if (diffDays === 1) return `Yesterday, ${timeFormatter.format(date)}`
  return dateTimeFormatter.format(date)
}

export function formatTime(value: DateLike) {
  const date = toValidDate(value)
  return date ? timeFormatter.format(date) : EMPTY_DISPLAY
}

export function formatShortDate(value: DateLike) {
  const date = toValidDate(value)
  return date ? shortDateFormatter.format(date) : EMPTY_DISPLAY
}

export function formatLongDate(value: DateLike) {
  const date = toValidDate(value)
  return date ? longDateFormatter.format(date) : EMPTY_DISPLAY
}

export const CURRENCY = 'USD'

/** Empty table cells and summaries: no em dash placeholder. */
export const EMPTY_DISPLAY = ''

const priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

/** USD for screens and receipts: whole dollars without `.00`, cents when needed. */
export function formatPrice(value: number) {
  if (!Number.isFinite(value)) return priceFormatter.format(0)
  return priceFormatter.format(value)
}

const lbpFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** Lebanese pounds. whole numbers, no currency symbol in the formatter. */
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
export function formatDocumentDate(iso: DateLike) {
  const date = toValidDate(iso)
  return date ? documentDateFormatter.format(date) : EMPTY_DISPLAY
}

/**
 * A `yyyy-mm-dd` the user typed, which is a calendar date and not an instant.
 *
 * `new Date('2026-11-03')` is parsed as UTC midnight, so west of Greenwich it
 * formats as the 2nd. the date on a document would be shown as the day before
 * the one that is printed on it. Reading the parts and building a local date
 * keeps the day the person entered.
 */
export function formatDateInput(value: string | null | undefined) {
  if (!value) return EMPTY_DISPLAY
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  const date = toValidDate(new Date(year, month - 1, day))
  return date ? documentDateFormatter.format(date) : value
}

const settingsDateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

/** Settings footnotes, e.g. "3 Nov 2026, 10:42". */
export function formatSettingsDateTime(iso: DateLike) {
  const date = toValidDate(iso)
  return date ? settingsDateTimeFormatter.format(date) : EMPTY_DISPLAY
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

/** Maps `resource.verb` audit actions to a short verb label (e.g. `user.delete` → delete). */
const AUDIT_VERB_LABELS: Record<string, string> = {
  delete: 'delete',
  remove: 'delete',
  destroy: 'delete',
  update: 'edit',
  edit: 'edit',
  patch: 'edit',
  change: 'change',
  modify: 'change',
  create: 'create',
  add: 'create',
  insert: 'create',
  sell: 'sell',
  sale: 'sell',
}

/**
 * Human-readable audit action: uses the part after the last `.` when present,
 * then maps known API verbs to short labels. Unknown verbs stay lowercased with
 * underscores as spaces.
 */
export function formatAuditAction(action: string): string {
  const raw = action.trim()
  if (!raw) return raw
  const verb = raw.includes('.') ? raw.slice(raw.lastIndexOf('.') + 1) : raw
  const key = verb.toLowerCase().replace(/-/g, '_')
  if (AUDIT_VERB_LABELS[key]) return AUDIT_VERB_LABELS[key]
  return verb.replace(/_/g, ' ').toLowerCase()
}

/** Turns API entity types (`user`, `opening_stock`, `transfer.line`) into short labels. */
export function formatAuditEntityType(entityType: string | null | undefined): string {
  const raw = String(entityType ?? '').trim()
  if (!raw) return EMPTY_DISPLAY
  return raw
    .split(/[./]/)
    .filter(Boolean)
    .map((segment) =>
      segment
        .split(/[_-]+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' '),
    )
    .join(' · ')
}

