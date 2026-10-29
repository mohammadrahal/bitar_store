'use client'

import Link from 'next/link'
import { Barcode, CircleOff, RotateCcw, Tag } from 'lucide-react'
import { Can } from '@/components/shared/can'
import { useSetVariantActive } from '@/hooks/use-skus'
import { formatBarcode } from '@/lib/barcode'
import { formatPrice } from '@/lib/format'
import type { ProductDetail, Variant } from '@/types'

/** One row per SKU: its own price, barcodes and on-sale status. */
export function SkuTable({
  product,
  onPrice,
  onBarcodes,
}: {
  product: ProductDetail
  onPrice: (variant: Variant) => void
  onBarcodes: (variant: Variant) => void
}) {
  const setActive = useSetVariantActive()
  const editable = !product.archived

  return (
    <div className="table-wrap">
      <table className="card-table">
        <caption className="sr-only">Color and size variants for {product.name}</caption>
        <thead>
          <tr>
            <th scope="col">Variant</th>
            <th scope="col">SKU</th>
            <th scope="col">Barcodes</th>
            <th scope="col" className="num">Price</th>
            <th scope="col">Status</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {product.variants.map((variant) => {
            const barcodes = product.barcodes[variant.id] ?? []
            const busy = setActive.isPending && setActive.variables?.variantId === variant.id
            return (
              <tr key={variant.id}>
                <td className="card-title">
                  <Link href={`/inventory/${variant.id}`} className="link-cell">
                    {variant.color} / {variant.size}
                  </Link>
                </td>
                <td className="td-code" data-label="SKU">{variant.sku}</td>
                <td className="tabular" data-label="Barcodes">
                  {barcodes.length === 0 ? '—' : formatBarcode(barcodes[0].code)}
                  {barcodes.length > 1 && <small> +{barcodes.length - 1}</small>}
                </td>
                <td className="num tabular" data-label="Price">{formatPrice(variant.sellPrice)}</td>
                <td data-label="Status">
                  <span className={`pill ${variant.archived ? 'pill-archived' : 'pill-healthy'}`}>
                    {variant.archived ? 'Inactive' : 'On sale'}
                  </span>
                </td>
                <td>
                  {editable && (
                    <Can permission="catalog.edit">
                      <div className="row-actions">
                        <button type="button" className="icon-btn" onClick={() => onPrice(variant)} aria-label={`Price of ${variant.sku}`} title="Price and history">
                          <Tag size={16} />
                        </button>
                        <button type="button" className="icon-btn" onClick={() => onBarcodes(variant)} aria-label={`Barcodes of ${variant.sku}`} title="Barcodes">
                          <Barcode size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          disabled={busy}
                          onClick={() => setActive.mutate({ variantId: variant.id, isActive: variant.archived, sku: variant.sku })}
                          aria-label={`${variant.archived ? 'Reactivate' : 'Deactivate'} ${variant.sku}`}
                          title={variant.archived ? 'Put back on sale' : 'Take off sale'}
                        >
                          {variant.archived ? <RotateCcw size={16} /> : <CircleOff size={16} />}
                        </button>
                      </div>
                    </Can>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
