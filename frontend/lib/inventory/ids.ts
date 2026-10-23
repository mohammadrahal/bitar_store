import type { Movement, Product } from './types'

export function createId(prefix: string) {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}_${random}`
}

function maxSuffix(values: string[], prefix: string) {
  return values.reduce((max, value) => {
    if (!value.startsWith(prefix)) return max
    const n = Number.parseInt(value.slice(prefix.length), 10)
    return Number.isFinite(n) && n > max ? n : max
  }, 0)
}

export function nextReference(prefix: 'PO-' | 'SO-' | 'TR-' | 'ADJ-', movements: Movement[]) {
  const next = maxSuffix(
    movements.map((m) => m.reference),
    prefix,
  )
  return `${prefix}${String(Math.max(next + 1, 1001)).padStart(4, '0')}`
}

export function nextSku(products: Product[]) {
  const next = maxSuffix(
    products.map((p) => p.sku),
    'SKU-',
  )
  return `SKU-${Math.max(next + 1, 10001)}`
}
