import type { InventoryFilter } from '@/types'

const FILTERS: InventoryFilter[] = ['all', 'low', 'out', 'on_hold', 'reserved', 'in_transit', 'archived']

export function parseInventoryFilter(value: string | null | undefined): InventoryFilter {
  if (value && FILTERS.includes(value as InventoryFilter)) return value as InventoryFilter
  return 'all'
}

export function inventoryHref(filter: InventoryFilter = 'all') {
  if (filter === 'all') return '/inventory'
  const qs = new URLSearchParams({ section: 'variants', filter })
  return `/inventory?${qs.toString()}`
}

/** Variant list with an optional filter; overview stays the default at `/inventory`. */
export function inventoryVariantsHref(filter: InventoryFilter = 'all') {
  const qs = new URLSearchParams({ section: 'variants' })
  if (filter !== 'all') qs.set('filter', filter)
  return `/inventory?${qs.toString()}`
}

export function inventoryVariantHref(variantId: string, filter: InventoryFilter = 'all') {
  const base = `/inventory/${variantId}`
  return filter === 'all' ? base : `${base}?filter=${filter}`
}
