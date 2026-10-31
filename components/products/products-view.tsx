'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { MotionSwap } from '@/components/motion/motion-swap'
import { SearchInput } from '@/components/shared/search-input'
import { ArchiveProductDialog } from '@/components/products/archive-product-dialog'
import { ProductForm } from '@/components/products/product-form'
import { ProductTable } from '@/components/products/product-table'
import { Can } from '@/components/shared/can'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Pagination } from '@/components/shared/pagination'
import { Panel } from '@/components/shared/panel'
import { SelectInput } from '@/components/shared/select-input'
import { Skeleton } from '@/components/shared/skeleton'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useCategories, useProducts } from '@/hooks/use-products'
import { useUIStore } from '@/store/ui-store'
import type { ProductWithVariants } from '@/types'

const PAGE_SIZE = 8

type Dialog = { kind: 'edit' | 'archive'; product: ProductWithVariants }

export function ProductsView() {
  const search = useUIStore((state) => state.productSearch)
  const setSearch = useUIStore((state) => state.setProductSearch)
  const category = useUIStore((state) => state.productCategory)
  const setCategory = useUIStore((state) => state.setProductCategory)
  const show = useUIStore((state) => state.productShow)
  const setShow = useUIStore((state) => state.setProductShow)

  const [searchInput, setSearchInput] = useState(search)
  const debounced = useDebouncedValue(searchInput)
  const [page, setPage] = useState(1)
  const [dialog, setDialog] = useState<Dialog | null>(null)

  useEffect(() => {
    if (debounced !== search) setSearch(debounced)
  }, [debounced, search, setSearch])

  useEffect(() => {
    setPage(1)
  }, [search, category, show])

  const filters = useMemo(() => ({ search, category, show }), [search, category, show])
  const { data: products, isPending, isError, error, refetch } = useProducts(filters)
  const { data: categories } = useCategories()

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
        description="Every model with its color and size variants."
        actions={
          <Can permission="catalog.create">
            <Link href="/products/new" className="btn btn-primary">
              <Plus size={16} aria-hidden="true" />
              Add product
            </Link>
          </Can>
        }
      />

      <Panel
        title={show === 'archived' ? 'Archived models' : 'Catalog'}
        description={isPending ? 'Loading…' : `${total} ${total === 1 ? 'model' : 'models'}`}
        actions={
          <div className="segmented compact" role="radiogroup" aria-label="Show">
            {(['active', 'archived'] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={show === option}
                className={show === option ? 'active' : ''}
                onClick={() => setShow(option)}
              >
                {option === 'active' ? 'Active' : 'Archived'}
              </button>
            ))}
          </div>
        }
      >
        <div className="toolbar">
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search name, code, category, SKU or barcode"
            aria-label="Search products"
          />
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

        <MotionSwap state={isPending ? 'loading' : isError ? 'error' : 'ready'}>
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
                dataset={`${show}-${currentPage}`}
                filtered={isFiltered}
                archivedView={show === 'archived'}
                onEdit={(product) => setDialog({ kind: 'edit', product })}
                onArchive={(product) => setDialog({ kind: 'archive', product })}
              />
              <Pagination page={currentPage} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
            </>
          )}
        </MotionSwap>
      </Panel>

      {dialog?.kind === 'edit' && <ProductForm key={dialog.product.id} product={dialog.product} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'archive' && <ArchiveProductDialog product={dialog.product} onClose={() => setDialog(null)} />}
    </>
  )
}
