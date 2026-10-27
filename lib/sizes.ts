import type { SizeSystem } from '@/types'

export const ONE_SIZE = 'One Size'

export const SIZE_SYSTEMS: Record<SizeSystem, { label: string; sizes: string[] }> = {
  letter: { label: 'Letter', sizes: ['XS', 'S', 'M', 'L', 'XL'] },
  numeric: { label: 'Numeric', sizes: ['34', '36', '38', '40', '42', '44'] },
  one: { label: 'One Size', sizes: [ONE_SIZE] },
}

/** Which system a model's existing sizes belong to, so added variants stay in it. */
export function sizeSystemOf(sizes: string[]): SizeSystem {
  if (sizes.some((size) => size === ONE_SIZE)) return 'one'
  if (sizes.some((size) => /^\d+$/.test(size))) return 'numeric'
  return 'letter'
}

/** Orders sizes the way they hang on a rail rather than alphabetically. */
export function compareSizes(a: string, b: string) {
  const order = [...SIZE_SYSTEMS.letter.sizes, ...SIZE_SYSTEMS.numeric.sizes, ONE_SIZE]
  const ia = order.indexOf(a)
  const ib = order.indexOf(b)
  if (ia === -1 || ib === -1) return a.localeCompare(b)
  return ia - ib
}
