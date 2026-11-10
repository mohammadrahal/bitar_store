'use client'

import { formatBarcode, isValidEan13 } from '@/lib/barcode'
import { ean13Svg } from '@/lib/ean13-svg'

export function InvoiceLineBarcode({ code }: { code: string }) {
  const trimmed = code.trim()
  if (!trimmed) return <span className="muted">—</span>

  const showSvg = isValidEan13(trimmed)
  return (
    <div className="invoice-line-barcode">
      {showSvg ? (
        <span
          className="invoice-line-barcode-svg"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: ean13Svg(trimmed, { height: 36, moduleWidth: 1.4 }) }}
        />
      ) : null}
      <span className="invoice-line-barcode-text tabular">{formatBarcode(trimmed)}</span>
    </div>
  )
}
