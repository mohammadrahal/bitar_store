/** Query `section` on `/inventory`. stock workflows grouped in one screen. */
export type InventoryHubSection =
  | 'variants'
  | 'sellers'
  | 'transfers'
  | 'receiving'
  | 'receive-stock'
  | 'replenishment'

const SECTION_VALUES: readonly InventoryHubSection[] = [
  'variants',
  'sellers',
  'transfers',
  'receiving',
  'receive-stock',
  'replenishment',
]

export function parseInventoryHubSection(value: string | null): InventoryHubSection | null {
  if (!value || value === 'overview') return null
  return SECTION_VALUES.includes(value as InventoryHubSection) ? (value as InventoryHubSection) : null
}

/** Routes that live outside `/inventory` but belong to the stock hub for nav highlighting. */
export function inventoryHubNavPath(pathname: string): string | null {
  if (pathname === '/transfers' || pathname.startsWith('/transfers/')) return '/inventory'
  if (pathname === '/replenishment' || pathname.startsWith('/replenishment/')) return '/inventory'
  return null
}

export function inventoryHubHref(section: InventoryHubSection, extra?: Record<string, string>): string {
  const qs = new URLSearchParams({ section })
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v !== '') qs.set(k, v)
    }
  }
  return `/inventory?${qs.toString()}`
}

type InventoryWorkspace = InventoryHubSection

/**
 * Where a workspace entry should land: dedicated routes when they exist, otherwise
 * the matching inventory tab.
 */
export function inventoryWorkspaceHref(section: InventoryWorkspace): string {
  switch (section) {
    case 'transfers':
      return '/transfers'
    case 'receive-stock':
      return '/stock-receipts'
    case 'replenishment':
      return '/replenishment'
    case 'variants':
      return inventoryHubHref('variants')
    default:
      return inventoryHubHref(section)
  }
}
