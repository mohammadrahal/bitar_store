/**
 * Query `section` on `/returns`.
 *
 * `desk` is the counter: find the sale, take the goods. `record` is everything
 * that has come back. Two tabs rather than two routes, because the person who
 * takes a return in is usually the person who then looks up whether the
 * customer already returned something last week.
 */
export type ReturnsHubSection = 'desk' | 'record'

const SECTION_VALUES: readonly ReturnsHubSection[] = ['desk', 'record']

export function parseReturnsHubSection(value: string | null): ReturnsHubSection | null {
  if (!value) return null
  return SECTION_VALUES.includes(value as ReturnsHubSection) ? (value as ReturnsHubSection) : null
}

export function returnsHubHref(section: ReturnsHubSection, extra?: Record<string, string>): string {
  const qs = new URLSearchParams({ section })
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value !== '') qs.set(key, value)
    }
  }
  return `/returns?${qs.toString()}`
}
