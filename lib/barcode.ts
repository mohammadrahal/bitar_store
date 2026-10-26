/**
 * In-store EAN-13 barcodes for own-brand goods.
 *
 * GS1 reserves the prefixes 20–29 for a retailer's internal use, so codes
 * minted here can never collide with a supplier's registered range. Layout:
 * `2` + an 11-digit sequence + the mod-10 check digit = 13 digits.
 */
const IN_STORE_PREFIX = '2'
const BODY_LENGTH = 12

/** Mod-10 check digit over the 12 data digits, weights alternating 1 and 3. */
function checkDigit(body: string): number {
  const sum = [...body].reduce(
    (total, char, index) => total + Number(char) * (index % 2 === 0 ? 1 : 3),
    0,
  )
  return (10 - (sum % 10)) % 10
}

export function buildEan13(sequence: number): string {
  const body = IN_STORE_PREFIX + String(sequence).padStart(BODY_LENGTH - 1, '0')
  return body + checkDigit(body)
}

/** True for 13 digits whose last one matches the other twelve. */
export function isValidEan13(value: string): boolean {
  if (!/^\d{13}$/.test(value)) return false
  const body = value.slice(0, BODY_LENGTH)
  return checkDigit(body) === Number(value[BODY_LENGTH])
}

/** Grouped for reading aloud or printing: 2 000000 000015. */
export function formatBarcode(value: string): string {
  if (!/^\d{13}$/.test(value)) return value
  return `${value.slice(0, 1)} ${value.slice(1, 7)} ${value.slice(7)}`
}
