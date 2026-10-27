'use client'

import Link from 'next/link'
import { Archive, ArchiveRestore, Package, Pencil } from 'lucide-react'
import { Can } from '@/components/shared/can'
import { EmptyState } from '@/components/shared/empty-state'
import { formatPrice } from '@/lib/format'
import type { ProductWithVariants } from '@/types'

function variantSummary(product: ProductWithVariants) {
  const sizes = new Set(product.variants.map((variant) => variant.size)).size
  const colors = new Set(product.variants.map((variant) => variant.color)).size
  return `${colors} ${colors === 1 ? 'color' : 'colors'} · ${sizes} ${sizes === 1 ? 'size' : 'sizes'}`
}

/** SKUs are priced one by one, so a model can sell at several prices. */
function hasPriceRange(product: ProductWithVariants) {
  return new Set(product.variants.filter((variant) => !variant.archived).map((variant) => variant.sellPrice)).size > 1
}

export function ProductTable({
  products,
  filtered,
  archivedView,
  onEdit,
  onArchive,
}: {
  products: ProductWithVariants[]
  /** True when a search or category filter is narrowing the list. */
  filtered: boolean
  archivedView: boolean
  onEdit: (product: ProductWithVariants) => void
  onArchive: (product: ProductWithVariants) => void
}) {
  if (products.length === 0) {
    return (
      <div className="panel-body">
        {filtered ? (
          <EmptyState icon={Package} title="No models match" description="Try a different search term or clear the category filter." />
        ) : archivedView ? (
          <EmptyState icon={Archive} title="Nothing archived" description="Archived models stay on file with their history and leave every picker." />
        ) : (
          <EmptyState
            icon={Package}
            title="No models yet"
            description="Add your first model with its colors and sizes."
            action={
              <Can action="products:create">
                <Link href="/products/new" className="btn btn-primary">
                  Add product
                </Link>
              </Can>
            }
          />
        )}
      </div>
    )
  }

  return (
    <div className="table-wrap">
      <table className="card-table">
        <caption className="sr-only">Models</caption>
        <thead>
          <tr>
            <th scope="col">Model</th>
            <th scope="col">Code</th>
            <th scope="col">Category</th>
            <th scope="col" className="num">Variants</th>
            <Can action="products:read-cost">
              <th scope="col" className="num">Cost</th>
            </Can>
            <th scope="col" className="num">Sell</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td className="card-title">
                <Link href={`/products/${product.id}`} className="link-cell">
                  {product.name}
                </Link>
                <small>{variantSummary(product)}</small>
              </td>
              <td className="td-code" data-label="Code">{product.code}</td>
              <td data-label="Category">{product.category}</td>
              <td className="num tabular" data-label="Variants">{product.variants.length}</td>
              <Can action="products:read-cost">
                <td className="num tabular" data-label="Cost">{formatPrice(product.costPrice)}</td>
              </Can>
              <td className="num tabular" data-label="Sell">
                {hasPriceRange(product) && <small>from </small>}
                {formatPrice(product.sellPrice)}
              </td>
              <td>
                <div className="row-actions">
                  {!product.archived && (
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
                  )}
                  <Can action="products:archive">
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => onArchive(product)}
                      aria-label={`${product.archived ? 'Reactivate' : 'Archive'} ${product.name}`}
                      title={product.archived ? 'Reactivate' : 'Archive'}
                    >
                      {product.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                    </button>
                  </Can>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
