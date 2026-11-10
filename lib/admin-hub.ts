/** Query `section` on `/admin`. admin tools in one screen. */
export type AdminHubSection =
  | 'users'
  | 'locations'
  | 'opening-stock'
  | 'reports'
  | 'audit'
  | 'settings'
  | 'suppliers'

const SECTION_VALUES: readonly AdminHubSection[] = [
  'users',
  'locations',
  'opening-stock',
  'reports',
  'audit',
  'settings',
  'suppliers',
]

export function parseAdminHubSection(value: string | null): AdminHubSection | null {
  if (!value) return null
  return SECTION_VALUES.includes(value as AdminHubSection) ? (value as AdminHubSection) : null
}

/**
 * Old top-level admin routes highlight the single **Admin** nav item when open.
 * Detail URLs stay as-is (`/branches/:id`, etc.).
 */
export function adminHubNavPath(pathname: string): string | null {
  if (pathname === '/users' || pathname.startsWith('/users/')) return '/admin'
  if (pathname === '/branches' || pathname.startsWith('/branches/')) return '/admin'
  if (pathname === '/opening-stock' || pathname.startsWith('/opening-stock/')) return '/admin'
  if (pathname === '/reports' || pathname.startsWith('/reports/')) return '/admin'
  if (pathname === '/audit' || pathname.startsWith('/audit/')) return '/admin'
  if (pathname === '/settings' || pathname.startsWith('/settings/')) return '/admin'
  return null
}

export function adminHubHref(section: AdminHubSection, extra?: Record<string, string>): string {
  const qs = new URLSearchParams({ section })
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v !== '') qs.set(k, v)
    }
  }
  return `/admin?${qs.toString()}`
}
