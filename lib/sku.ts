function token(value: string, length: number) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, length)
}

/** Permanent model code from a sequence number: 123 -> "MD000123". */
export function formatModelCode(sequence: number) {
  return `MD${String(sequence).padStart(6, '0')}`
}

function sizeToken(size: string) {
  if (/^one\s*size$/i.test(size.trim())) return 'OS'
  return token(size, 4) || 'OS'
}

/** Color and size part of a SKU: "Black" / "S" -> "BLK-S", "Sand" / "One Size" -> "SND-OS". */
export function buildVariantCode(color: string, size: string) {
  const letters = token(color, 12)
  const consonants = letters[0] + letters.slice(1).replace(/[AEIOU]/g, '')
  const colorToken = (consonants.length >= 3 ? consonants : letters).slice(0, 3) || 'STD'
  return `${colorToken}-${sizeToken(size)}`
}

/** Full SKU: "MD000123-BLK-S". Shown to people as "MD000123 · BLK-S". */
export function buildSku(modelCode: string, variantCode: string) {
  return `${modelCode}-${variantCode}`
}
