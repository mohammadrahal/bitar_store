'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, Download } from 'lucide-react'
import { MotionSwap } from '@/components/motion/motion-swap'
import { SearchInput } from '@/components/shared/search-input'
import { BalanceTiles } from '@/components/inventory/balance-tiles'
import { InventoryTable } from '@/components/inventory/inventory-table'
import { SelectedVariantCard } from '@/components/inventory/selected-variant-card'
import { Can } from '@/components/shared/can'
import { ErrorState } from '@/components/shared/error-state'
import { FilterChips, type ChipOption } from '@/components/shared/filter-chips'
import { PageHeader } from '@/components/shared/page-header'
import { Pagination } from '@/components/shared/pagination'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useBranchScope } from '@/hooks/use-branch-scope'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useInventory } from '@/hooks/use-inventory'
import { downloadCsv } from '@/lib/csv'
import { sumBalances } from '@/lib/balances'
import { parseInventoryFilter } from '@/lib/inventory-filters'
import type { InventoryFilter, InventoryRow } from '@/types'

const PAGE_SIZE = 12

const FILTERS: ChipOption<InventoryFilter>[] = [
  { value: 'all', label: 'All' },
  { value: 'low', label: 'Low stock' },
  { value: 'on_hold', label: 'Non-sellable' },
  { value: 'in_transit', label: 'In transit' },
  { value: 'archived', label: 'Archived' },
]

function exportRows(rows: InventoryRow[]) {
  downloadCsv(
    'inventory.csv',
    [
      'Product',
      'Code',
      'SKU',
      'Color',
      'Size',
      'On hand',
      'Non-sellable',
      'Reserved',
      'On hold',
      'Available',
      'In transit',
    ],
    rows.map((row) => [
      row.productName,
      row.productCode,
      row.sku,
      row.color,
      row.size,
      row.onHand,
      row.nonSellable,
      /* The API cannot report these two yet; an empty cell says so. */
      row.reserved ?? '',
      row.onHold ?? '',
      row.available,
      row.inTransit,
    ]),
  )
}

export function InventoryView() {
  const scope = useBranchScope()
  const searchParams = useSearchParams()
  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput)
  const [filter, setFilter] = useState<InventoryFilter>(() => parseInventoryFilter(searchParams.get('filter')))
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    setFilter(parseInventoryFilter(searchParams.get('filter')))
    setPage(1)
  }, [searchParams])

  const { data: rows, isPending, isError, error, refetch } = useInventory({ scope, filter, search })
  const totals = useMemo(() => sumBalances(rows ?? []), [rows])

  const total = rows?.length ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = rows?.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE) ?? []
  const selected = selectedId ?? visible[0]?.variantId ?? null
  const filtered = filter !== 'all' || search.trim() !== ''

  return (
    <>
      <PageHeader
        eyebrow="Inventory"
        title="Stock by variant"
        description="Every color and size with its five balances. Available is what can be sold or sent."
        actions={
          <>
            <button type="button" className="btn btn-secondary" disabled={!rows?.length} onClick={() => rows && exportRows(rows)}>
              <Download size={16} aria-hidden="true" />
              Export CSV
            </button>
            <Can permission="movements.request">
              <Link href="/transfers/new" className="btn btn-primary">
                <ArrowLeftRight size={16} aria-hidden="true" />
                New transfer
              </Link>
            </Can>
          </>
        }
      />

      <MotionSwap state={isPending ? 'loading' : isError ? 'error' : 'ready'}>
        {isPending ? (
          <Skeleton rows={4} stats={5} />
        ) : isError ? (
          <ErrorState title="Could not load inventory" error={error} onRetry={() => void refetch()} />
        ) : (
          <div className="stack">
            <BalanceTiles totals={totals} />
            <div className="split">
              <Panel title="Variants" description={`${total} ${total === 1 ? 'variant' : 'variants'}`}>
                <div className="toolbar">
                  <SearchInput
                    value={searchInput}
                    onChange={(value) => {
                      setSearchInput(value)
                      setPage(1)
                    }}
                    placeholder="Search model, code, SKU, color or size"
                    aria-label="Search inventory"
                  />
                  <FilterChips
                    label="Filter variants"
                    options={FILTERS}
                    value={filter}
                    onChange={(value) => {
                      setFilter(value)
                      setPage(1)
                    }}
                  />
                </div>
                <InventoryTable
                  rows={visible}
                  dataset={`${scope}-${currentPage}`}
                  totals={totals}
                  selectedId={selected}
                  onSelect={(row) => setSelectedId(row.variantId)}
                  filtered={filtered}
                />
                <Pagination page={currentPage} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
              </Panel>
              <aside className="split-aside" aria-label="Selected variant">
                {selected && <SelectedVariantCard variantId={selected} />}
              </aside>
            </div>
          </div>
        )}
      </MotionSwap>
    </>
  )
}
