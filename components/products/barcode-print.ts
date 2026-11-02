import { formatBarcode } from '@/lib/barcode'
import { ean13Svg } from '@/lib/ean13-svg'
import { printHtmlDocument } from '@/lib/print-document'

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

const PRINT_STYLES = `
  @page { margin: 12mm; }
  body { font-family: system-ui, sans-serif; margin: 0; color: #000; }
  .barcode-sheet { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  .barcode-label { break-inside: avoid; border: 1px solid #ccc; padding: 12px; text-align: center; }
  .barcode-label-product { margin: 0 0 4px; font-size: 13px; font-weight: 600; }
  .barcode-label-variant { margin: 0 0 10px; font-size: 11px; color: #444; }
  .barcode-label-bars { display: flex; justify-content: center; margin: 0 0 6px; }
  .barcode-label-code { margin: 0; font-size: 14px; letter-spacing: 0.12em; font-variant-numeric: tabular-nums; }
  @media print { .barcode-label { border-color: #999; } }
`

export function printBarcodeLabels(labels: BarcodeLabel[]) {
  const printable = labels.filter((label) => label.code.trim())
  if (printable.length === 0) return
  const body = `<style>${PRINT_STYLES}</style><div class="barcode-sheet">${printable.map(labelHtml).join('')}</div>`
  printHtmlDocument('Barcode labels', body)
}
