import { formatBarcode } from '@/lib/barcode'
import { ean13Svg } from '@/lib/ean13-svg'
import { printHtmlDocument } from '@/lib/print-document'
import { BARCODE_PRINT_CSS } from '@/lib/print-styles'

export interface BarcodeLabel {
  productName: string
  variantLabel: string
  sku: string
  code: string
}

function labelHtml(label: BarcodeLabel) {
  const svg = ean13Svg(label.code, { height: 56, moduleWidth: 2 })
  return `
    <article class="barcode-label">
      <p class="barcode-label-product">${escapeHtml(label.productName)}</p>
      <p class="barcode-label-variant">${escapeHtml(label.variantLabel)} · ${escapeHtml(label.sku)}</p>
      <div class="barcode-label-bars">${svg}</div>
      <p class="barcode-label-code">${escapeHtml(formatBarcode(label.code))}</p>
    </article>
  `
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function printBarcodeLabels(labels: BarcodeLabel[]) {
  const printable = labels.filter((label) => label.code.trim())
  if (printable.length === 0) return
  const body = `<style>${BARCODE_PRINT_CSS}</style><div class="barcode-sheet">${printable.map(labelHtml).join('')}</div>`
  printHtmlDocument('Barcode labels', body)
}
