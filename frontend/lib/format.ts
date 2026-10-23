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
