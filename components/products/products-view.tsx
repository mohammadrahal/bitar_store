'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { ProductForm } from '@/components/products/product-form'
import { ProductTable } from '@/components/products/product-table'
import { Can } from '@/components/shared/can'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Pagination } from '@/components/shared/pagination'
import { Panel } from '@/components/shared/panel'
import { SelectInput } from '@/components/shared/select-input'
import { Skeleton } from '@/components/shared/skeleton'
import { useCategories, useDeleteProduct, useProducts } from '@/hooks/use-products'
import { useUIStore } from '@/store/ui-store'
import type { ProductWithVariants } from '@/types'

const PAGE_SIZE = 8
const SEARCH_DEBOUNCE_MS = 250

type Dialog = { kind: 'create' } | { kind: 'edit'; product: ProductWithVariants } | { kind: 'delete'; product: ProductWithVariants }

export function ProductsView() {
  const search = useUIStore((state) => state.productSearch)
  const setSearch = useUIStore((state) => state.setProductSearch)
  const category = useUIStore((state) => state.productCategory)
  const setCategory = useUIStore((state) => state.setProductCategory)

  const [searchInput, setSearchInput] = useState(search)
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const close = () => setDialog(null)

  // Typing updates the query a beat later, so each keystroke is not its own fetch.
  useEffect(() => {
    if (searchInput === search) return
    const timer = setTimeout(() => setSearch(searchInput), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchInput, search, setSearch])

  useEffect(() => {
    setPage(1)
  }, [search, category])

  const filters = useMemo(() => ({ search, category }), [search, category])
  const { data: products, isPending, isError, error, refetch } = useProducts(filters)
  const { data: categories } = useCategories()
  const remove = useDeleteProduct()

  const total = products?.length ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = products?.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE) ?? []
  const isFiltered = search.trim() !== '' || category !== ''

  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="Products"
        description="Every style in the catalog with its size and color variants."
        actions={
          <Can action="products:create">
            <button type="button" className="btn btn-primary" onClick={() => setDialog({ kind: 'create' })}>
              <Plus size={16} aria-hidden="true" />
              Add product
            </button>
          </Can>
        }
      />

      <Panel title="Catalog" description={isPending ? 'Loading…' : `${total} ${total === 1 ? 'product' : 'products'}`}>
        <div className="toolbar">
          <div className="search-field">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search name, category, SKU or barcode"
              aria-label="Search products"
            />
          </div>
          <SelectInput
            variant="inline"
            aria-label="Filter by category"
            value={category}
            onValueChange={setCategory}
            options={[
              { value: '', label: 'All categories' },
              ...(categories?.map((option) => ({ value: option, label: option })) ?? []),
            ]}
          />
          {isFiltered && (
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                setSearchInput('')
                setSearch('')
                setCategory('')
              }}
            >
              Clear filters
            </button>
          )}
        </div>

        {isPending ? (
          <div className="panel-body">
            <Skeleton rows={1} stats={0} />
          </div>
        ) : isError ? (
          <div className="panel-body">
            <ErrorState title="Could not load products" error={error} onRetry={() => void refetch()} />
          </div>
        ) : (
          <>
            <ProductTable
              products={visible}
              filtered={isFiltered}
              onCreate={() => setDialog({ kind: 'create' })}
              onEdit={(product) => setDialog({ kind: 'edit', product })}
              onDelete={(product) => setDialog({ kind: 'delete', product })}
            />
            <Pagination page={currentPage} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
          </>
        )}
      </Panel>

      {dialog?.kind === 'create' && <ProductForm onClose={close} />}
      {dialog?.kind === 'edit' && <ProductForm key={dialog.product.id} product={dialog.product} onClose={close} />}
      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          title={`Delete ${dialog.product.name}?`}
          description={`This removes ${dialog.product.variants.length} ${
            dialog.product.variants.length === 1 ? 'variant' : 'variants'
          } and their stock records in every branch. This cannot be undone.`}
          confirmLabel="Delete product"
          tone="danger"
          onResolve={(confirmed) => {
            const { id, name } = dialog.product
            close()
            if (confirmed) remove.mutate({ productId: id, name })
          }}
        />
      )}
    </>
  )
}
