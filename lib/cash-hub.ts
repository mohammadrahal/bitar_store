/** Query `section` on `/cash`. The drawer and the shift record in one screen. */
export type CashHubSection = 'drawer' | 'shifts'

const SECTION_VALUES: readonly CashHubSection[] = ['drawer', 'shifts']

export function parseCashHubSection(value: string | null): CashHubSection | null {
  if (!value) return null
  return SECTION_VALUES.includes(value as CashHubSection) ? (value as CashHubSection) : null
}

export function cashHubHref(section: CashHubSection, extra?: Record<string, string>): string {
  const qs = new URLSearchParams({ section })
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value !== '') qs.set(key, value)
    }
  }
  return `/cash?${qs.toString()}`
}
