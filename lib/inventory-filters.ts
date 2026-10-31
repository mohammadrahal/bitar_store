import type { InventoryFilter } from '@/types'

const FILTERS: InventoryFilter[] = ['all', 'out', 'on_hold', 'in_transit', 'archived']

export function parseInventoryFilter(value: string | null | undefined): InventoryFilter {
  if (value && FILTERS.includes(value as InventoryFilter)) return value as InventoryFilter
  return 'all'
}

export function inventoryHref(filter: InventoryFilter = 'all') {
  return filter === 'all' ? '/inventory' : `/inventory?filter=${filter}`
}
