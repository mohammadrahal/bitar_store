function token(value: string, length: number) {
  const letters = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return letters.slice(0, length)
}

/**
 * Deterministic SKU from the product name plus a variant's size and color,
 * e.g. "Oxford Shirt" / "M" / "White" -> "OXSH-M-WHI".
 */
export function buildSku(productName: string, size: string, color: string) {
  const name =
    productName
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => token(word, 2))
      .join('')
      .slice(0, 4) || 'ITEM'
  return [name, token(size, 3) || 'OS', token(color, 3) || 'STD'].join('-')
}
