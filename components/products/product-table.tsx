'use client'

import Link from 'next/link'
import { Package, Pencil, Trash2 } from 'lucide-react'
import { Can } from '@/components/shared/can'
import { EmptyState } from '@/components/shared/empty-state'
import { formatBarcode } from '@/lib/barcode'
import { formatPrice } from '@/lib/format'
import type { ProductWithVariants } from '@/types'

function variantSummary(product: ProductWithVariants) {
  const sizes = [...new Set(product.variants.map((variant) => variant.size))]
  const colors = [...new Set(product.variants.map((variant) => variant.color))]
  return `${sizes.length} ${sizes.length === 1 ? 'size' : 'sizes'} · ${colors.length} ${colors.length === 1 ? 'color' : 'colors'}`
}

function barcodeSummary(product: ProductWithVariants) {
  const barcodes = product.variants.map((variant) => variant.barcode).filter(Boolean)
  if (barcodes.length === 0) return null
  return { primary: formatBarcode(barcodes[0]), extra: barcodes.length - 1 }
}

export function ProductTable({
  products,
  filtered,
  onEdit,
  onDelete,
  onCreate,
}: {
  products: ProductWithVariants[]
  /** True when a search or category filter is narrowing the list. */
  filtered: boolean
  onEdit: (product: ProductWithVariants) => void
  onDelete: (product: ProductWithVariants) => void
  onCreate: () => void
}) {
  if (products.length === 0) {
    return (
      <div className="panel-body">
        {filtered ? (
          <EmptyState
            icon={Package}
            title="No products match"
            description="Try a different search term or clear the category filter."
          />
        ) : (
          <EmptyState
            icon={Package}
            title="No products yet"
            description="Add your first style and its size and color variants."
            action={
              <Can action="products:create">
                <button type="button" className="btn btn-primary" onClick={onCreate}>
                  Add product
                </button>
              </Can>
            }
          />
        )}
      </div>
    )
  }

  return (
    <div className="table-wrap">
      <table>
        <caption className="sr-only">Products</caption>
        <thead>
          <tr>
            <th scope="col">Product</th>
            <th scope="col">Barcode</th>
            <th scope="col">Category</th>
            <th scope="col" className="num">
              Variants
            </th>
            <Can action="products:read-cost">
              <th scope="col" className="num">
                Cost
              </th>
            </Can>
            <th scope="col" className="num">
              Sell
            </th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const barcode = barcodeSummary(product)
            return (
            <tr key={product.id}>
              <td>
                <Link href={`/products/${product.id}`} className="link-cell">
                  {product.name}
                </Link>
                <small>{variantSummary(product)}</small>
              </td>
              <td className="tabular">
                {barcode ? (
                  <>
                    <span>{barcode.primary}</span>
                    {barcode.extra > 0 && <small>+ {barcode.extra} more</small>}
                  </>
                ) : (
                  '—'
                )}
              </td>
              <td>{product.category}</td>
              <td className="num tabular">{product.variants.length}</td>
              <Can action="products:read-cost">
                <td className="num tabular">{formatPrice(product.costPrice)}</td>
              </Can>
              <td className="num tabular">{formatPrice(product.sellPrice)}</td>
              <td>
                <div className="row-actions">
                  <Can action="products:edit">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => onEdit(product)}
                      aria-label={`Edit ${product.name}`}
                      title="Edit"
                    >
                      <Pencil size={16} />
                    </button>
                  </Can>
                  <Can action="products:delete">
                    <button
                      type="button"
                      className="icon-btn danger"
                      onClick={() => onDelete(product)}
                      aria-label={`Delete ${product.name}`}
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </Can>
                </div>
              </td>
            </tr>
          )})}
        </tbody>
      </table>
    </div>
  )
}
