'use client'

import Link from 'next/link'
import { Archive, ArchiveRestore, Package, Pencil } from 'lucide-react'
import { MotionTbody, MotionTr } from '@/components/motion/motion-table'
import { Can } from '@/components/shared/can'
import { EmptyState } from '@/components/shared/empty-state'
import { SortableTh } from '@/components/shared/sortable-th'
import { useSortedRows, type SortAccessors } from '@/hooks/use-sorted-rows'
import { formatNumber, formatPrice } from '@/lib/format'
import type { ProductWithVariants, Units } from '@/types'

type SortKey = 'name' | 'code' | 'category' | 'variants' | 'stock' | 'price'

function variantSummary(product: ProductWithVariants) {
  const sizes = new Set(product.variants.map((variant) => variant.size)).size
  const colors = new Set(product.variants.map((variant) => variant.color)).size
  return `${colors} ${colors === 1 ? 'color' : 'colors'} · ${sizes} ${sizes === 1 ? 'size' : 'sizes'}`
}

/** SKUs are priced one by one, so a model can sell at several prices. */
function hasPriceRange(product: ProductWithVariants) {
  return new Set(product.variants.filter((variant) => !variant.archived).map((variant) => variant.sellPrice)).size > 1
}

/** Available units, with on hand named beside it when some are not sellable. */
function StockCell({ units, loading }: { units?: Units; loading: boolean }) {
  if (loading) return <span className="muted">…</span>
  const available = units?.available ?? 0
  const onHand = units?.onHand ?? 0
  return (
    <>
      {formatNumber(available)}
      {onHand !== available && <small>{formatNumber(onHand)} on hand</small>}
    </>
  )
}

export function ProductTable({
  products,
  filtered,
  archivedView,
  onEdit,
  onArchive,
  dataset,
  units,
  unitsScopeName,
}: {
  products: ProductWithVariants[]
  /** True when a search or category filter is narrowing the list. */
  filtered: boolean
  archivedView: boolean
  onEdit: (product: ProductWithVariants) => void
  onArchive: (product: ProductWithVariants) => void
  /** Names the page and view on screen, so the entrance plays once per set. */
  dataset?: string
  /** Units per model id in the scope on screen; undefined while they load. */
  units?: Record<string, Units>
  /** The location the Stock column covers, when the header filter names one. */
  unitsScopeName?: string
}) {
  const accessors: SortAccessors<ProductWithVariants, SortKey> = {
    name: (product) => product.name,
    code: (product) => product.code,
    category: (product) => product.category,
    variants: (product) => product.variants.length,
    /* Sorts on what can actually be sold, which is the figure the cell leads
       with; a model whose units have not arrived yet sorts as zero, not last. */
    stock: (product) => units?.[product.id]?.available ?? 0,
    price: (product) => product.sellPrice,
  }
  const sort = useSortedRows<ProductWithVariants, SortKey>(
    products,
    accessors,
    { key: 'name', direction: 'asc' },
    ['variants', 'stock', 'price'],
  )
  const visible = sort.rows ?? []

  if (products.length === 0) {
    return (
      <div className="panel-body">
        {filtered ? (
          <EmptyState
            icon={Package}
            title="No models match"
            description={
              unitsScopeName
                ? `Nothing here matches, or nothing matching is stocked at ${unitsScopeName}. Switch to All models to see the rest of the catalog.`
                : 'Try a different search term or clear the category filter.'
            }
          />
        ) : archivedView ? (
          <EmptyState icon={Archive} title="Nothing archived" description="Archived models stay on file with their history and leave every picker." />
        ) : (
          <EmptyState
            icon={Package}
            title="No models yet"
            description="Add your first model with its colors and sizes."
            action={
              <Can permission="catalog.create">
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
            <SortableTh columnKey="name" label="Model" sort={sort} />
            <SortableTh columnKey="code" label="Code" sort={sort} />
            <SortableTh columnKey="category" label="Category" sort={sort} />
            <SortableTh columnKey="variants" label="Variants" sort={sort} numeric />
            <SortableTh
              columnKey="stock"
              label={unitsScopeName ? `Stock · ${unitsScopeName}` : 'Stock'}
              sort={sort}
              numeric
            />
            <SortableTh columnKey="price" label="Sell" sort={sort} numeric />
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <MotionTbody dataset={dataset}>
          {visible.map((product, index) => (
            <MotionTr key={product.id} index={index}>
              <td className="card-title">
                <Link href={`/products/${product.id}`} className="link-cell">
                  {product.name}
                </Link>
                <small>{variantSummary(product)}</small>
              </td>
              <td className="td-code" data-label="Code">{product.code}</td>
              <td data-label="Category">{product.category}</td>
              <td className="num tabular" data-label="Variants">{product.variants.length}</td>
              <td className="num tabular" data-label="Stock">
                <StockCell units={units?.[product.id]} loading={units === undefined} />
              </td>
              <td className="num tabular" data-label="Sell">
                {hasPriceRange(product) && <small>from </small>}
                {formatPrice(product.sellPrice)}
              </td>
              <td>
                <div className="row-actions">
                  {!product.archived && (
                    <Can permission="catalog.edit">
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
                  <Can permission="catalog.edit">
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
            </MotionTr>
          ))}
        </MotionTbody>
      </table>
    </div>
  )
}
