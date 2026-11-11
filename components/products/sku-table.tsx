'use client'

import Link from 'next/link'
import { Barcode, CircleOff, Pencil, Printer, RotateCcw } from 'lucide-react'
import { printBarcodeLabels } from '@/components/products/barcode-print'
import { Can } from '@/components/shared/can'
import { useBranchScope } from '@/hooks/use-branch-scope'
import { useSetVariantActive } from '@/hooks/use-skus'
import { useVariantUnits } from '@/hooks/use-stock'
import { formatBarcode } from '@/lib/barcode'
import { formatNumber, formatPrice } from '@/lib/format'
import { Pagination } from '@/components/shared/pagination'
import { usePagination } from '@/hooks/use-pagination'
import { useCurrentUser } from '@/store/user-store'
import type { ProductDetail, Variant } from '@/types'

/** One row per SKU: its own price, barcodes and on-sale status. */
export function SkuTable({
  product,
  onEdit,
  onBarcodes,
}: {
  product: ProductDetail
  onEdit: (variant: Variant) => void
  onBarcodes: (variant: Variant) => void
}) {
  const setActive = useSetVariantActive()
  const showCost = useCurrentUser().canViewCosts
  const scope = useBranchScope()
  const { data: units } = useVariantUnits(product.id, scope)
  const editable = !product.archived
  const { visible, page, pageCount, total, pageSize, setPage } = usePagination(product.variants, 15, product.id)

  return (
    <>
    <div className="table-wrap">
      <table className="card-table sku-table">
        <caption className="sr-only">Color and size variants for {product.name}</caption>
        <thead>
          <tr>
            <th scope="col">Variant</th>
            <th scope="col">SKU</th>
            <th scope="col">Barcodes</th>
            {showCost ? <th scope="col" className="num">Cost</th> : null}
            <th scope="col" className="num">Sell price</th>
            <th scope="col" className="num">Available</th>
            <th scope="col">Status</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {visible.map((variant) => {
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
                  {barcodes.length === 0 ? '' : formatBarcode(barcodes[0].code)}
                  {barcodes.length > 1 && <small> +{barcodes.length - 1}</small>}
                </td>
                {showCost ? (
                  <td className="num tabular" data-label="Cost">
                    {variant.unitCost != null && variant.unitCost > 0 ? formatPrice(variant.unitCost) : ''}
                  </td>
                ) : null}
                <td className="num tabular" data-label="Sell price">{formatPrice(variant.sellPrice)}</td>
                <td className="num tabular" data-label="Available">
                  {units === undefined ? (
                    <span className="muted">…</span>
                  ) : (
                    <Link href={`/inventory/${variant.id}`} className="link-cell tabular" title="View stock by location">
                      {formatNumber(units[variant.id]?.available ?? 0)}
                      {(units[variant.id]?.onHand ?? 0) !== (units[variant.id]?.available ?? 0) && (
                        <small className="block muted">
                          {formatNumber(units[variant.id]?.onHand ?? 0)} on hand
                        </small>
                      )}
                    </Link>
                  )}
                </td>
                <td data-label="Status">
                  <span className={`pill ${variant.archived ? 'pill-archived' : 'pill-healthy'}`}>
                    {variant.archived ? 'Inactive' : 'On sale'}
                  </span>
                </td>
                <td>
                  {editable && (
                    <Can permission="catalog.edit">
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => onEdit(variant)}
                          aria-label={`Edit ${variant.sku}`}
                          title="Edit color, size and price"
                        >
                          <Pencil size={14} aria-hidden="true" />
                          Edit
                        </button>
                        <button type="button" className="icon-btn" onClick={() => onBarcodes(variant)} aria-label={`Barcodes of ${variant.sku}`} title="Barcodes">
                          <Barcode size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn"
                          disabled={barcodes.length === 0}
                          onClick={() =>
                            printBarcodeLabels(
                              barcodes.map((row) => ({
                                productName: product.name,
                                variantLabel: `${variant.color} / ${variant.size}`,
                                sku: variant.sku,
                                code: row.code,
                              })),
                            )
                          }
                          aria-label={`Print barcodes for ${variant.sku}`}
                          title="Print barcode"
                        >
                          <Printer size={16} />
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
    <Pagination page={page} pageCount={pageCount} total={total} pageSize={pageSize} onPage={setPage} />
    </>
  )
}
