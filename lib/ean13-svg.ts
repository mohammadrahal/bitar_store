/** EAN-13 bar patterns (L, G, R) for label printing. */
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'] as const
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'] as const
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'] as const
const PARITY = [
  'LLLLLL',
  'LLGLGG',
  'LLGGLG',
  'LLGGGL',
  'LGLLGG',
  'LGGLLG',
  'LGGGLL',
  'LGLGLG',
  'LGLGGL',
  'LGGLGL',
] as const

function encodeEan13(code: string): string | null {
  if (!/^\d{13}$/.test(code)) return null
  const first = Number(code[0])
  const parity = PARITY[first]
  if (!parity) return null
  let modules = '101'
  for (let i = 0; i < 6; i++) {
    const digit = Number(code[i + 1])
    const table = parity[i] === 'L' ? L : G
    modules += table[digit]
  }
  modules += '01010'
  for (let i = 0; i < 6; i++) {
    modules += R[Number(code[i + 7])]
  }
  modules += '101'
  return modules
}

/** SVG bars for a 13-digit EAN; falls back to text when the code is not valid EAN-13. */
export function ean13Svg(code: string, { height = 48, moduleWidth = 2 } = {}): string {
  const modules = encodeEan13(code.replace(/\s/g, ''))
  if (!modules) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="${height}" role="img"><text x="0" y="${height / 2}" font-size="14">${code}</text></svg>`
  }
  const width = modules.length * moduleWidth
  let x = 0
  const rects = [...modules]
    .map((bit) => {
      const rect = bit === '1' ? `<rect x="${x}" y="0" width="${moduleWidth}" height="${height}" fill="#000"/>` : ''
      x += moduleWidth
      return rect
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Barcode ${code}">${rects}</svg>`
}
