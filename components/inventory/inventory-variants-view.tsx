'use client'

import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeftRight, Download } from 'lucide-react'
import { MotionSwap } from '@/components/motion/motion-swap'
import { SearchInput } from '@/components/shared/search-input'
import { BalanceTiles } from '@/components/inventory/balance-tiles'
import { CorrectStockDrawer } from '@/components/inventory/correct-stock-drawer'
import { InventoryTable } from '@/components/inventory/inventory-table'
import { QuickTransferDrawer, type QuickTransferVariant } from '@/components/inventory/quick-transfer-drawer'
import { TransfersActivityPanel } from '@/components/inventory/transfers-activity-panel'
import { ErrorState } from '@/components/shared/error-state'
import { FilterChips, type ChipOption } from '@/components/shared/filter-chips'
import { PageHeader } from '@/components/shared/page-header'
import { Pagination } from '@/components/shared/pagination'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useBranchScope } from '@/hooks/use-branch-scope'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useInventory } from '@/hooks/use-inventory'
import { usePermission } from '@/hooks/use-permission'
import { downloadCsv } from '@/lib/csv'
import { sumBalances } from '@/lib/balances'
import { parseInventoryFilter } from '@/lib/inventory-filters'
import { variantLabel } from '@/lib/variant-label'
import { ALL_BRANCHES, type InventoryFilter, type InventoryRow } from '@/types'

const PAGE_SIZE = 12

const FILTERS: ChipOption<InventoryFilter>[] = [
  { value: 'all', label: 'All' },
  { value: 'low', label: 'Low stock' },
  { value: 'out', label: 'Out of stock' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'reserved', label: 'Reserved' },
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
      row.reserved ?? '',
      row.onHold ?? '',
      row.available,
      row.inTransit,
    ]),
  )
}

const asTransferVariant = (row: InventoryRow): QuickTransferVariant => ({
  variantId: row.variantId,
  label: variantLabel(row),
  sku: row.sku,
})

/**
 * Variant list & balances. The default tab of the inventory hub, and the screen
 * warehouse staff keep open all day.
 *
 * It is a workspace, not a report: every row carries the two operations it
 * leads to (send some of it somewhere, correct what it says) as a drawer over
 * this list, and a run of rows can be ticked and sent as one shipment. The
 * figures behind those drawers come from the same queries the table reads, so
 * nothing on screen can disagree with what the drawer is about to post.
 */
export function InventoryVariantsView({ showPageHeader = true }: { showPageHeader?: boolean }) {
  const scope = useBranchScope()
  const searchParams = useSearchParams()
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') ?? '')
  const search = useDebouncedValue(searchInput)
  const [filter, setFilter] = useState<InventoryFilter>(() => parseInventoryFilter(searchParams.get('filter')))
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const { canAnywhere, canRequestTransfer } = usePermission()
  const mayCorrect = canAnywhere('stock.adjust')
  const mayTransfer = canRequestTransfer()

  /** Rows ticked for one shipment, by variant id, kept across pages. */
  const [checked, setChecked] = useState<Set<string>>(() => new Set())
  const [picked, setPicked] = useState<Map<string, QuickTransferVariant>>(() => new Map())
  const [correcting, setCorrecting] = useState<InventoryRow | null>(null)
  const [sending, setSending] = useState<QuickTransferVariant[] | null>(null)
  /* The branch filter in the header is the location someone is working in, so
     both drawers start there; with the filter on every location they fall back
     to the one that actually holds the stock. */
  const scopedBranchId = scope === ALL_BRANCHES ? undefined : scope

  useEffect(() => {
    setFilter(parseInventoryFilter(searchParams.get('filter')))
    const fromUrl = searchParams.get('search')
    if (fromUrl !== null) setSearchInput(fromUrl)
    setPage(1)
  }, [searchParams])

  /* `/` jumps to the search box from anywhere on the page, the shortcut every
     list in every tool has; it stays out of the way while someone is typing in
     a field, and Ctrl/Cmd+K still opens the palette over the whole app. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target?.isContentEditable) return
      if (target && /^(input|textarea|select)$/i.test(target.tagName)) return
      /* A drawer is open over the list: moving the cursor to a box behind it
         would scroll the page under the overlay and lose the drawer's focus. */
      if (document.querySelector('[role="dialog"]')) return
      event.preventDefault()
      searchRef.current?.focus()
      searchRef.current?.select()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const { data: rows, isPending, isError, error, refetch } = useInventory({ scope, filter, search })
  const totals = useMemo(() => sumBalances(rows ?? []), [rows])

  const total = rows?.length ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = rows?.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE) ?? []
  const highlightedId = selectedId ?? visible[0]?.variantId ?? null
  const filtered = filter !== 'all' || search.trim() !== ''

  const toggle = useCallback((row: InventoryRow) => {
    setChecked((current) => {
      const next = new Set(current)
      if (next.has(row.variantId)) next.delete(row.variantId)
      else next.add(row.variantId)
      return next
    })
    setPicked((current) => {
      const next = new Map(current)
      if (next.has(row.variantId)) next.delete(row.variantId)
      else next.set(row.variantId, asTransferVariant(row))
      return next
    })
  }, [])

  const toggleAll = useCallback((pageRows: InventoryRow[]) => {
    const allOn = pageRows.every((row) => checked.has(row.variantId))
    setChecked((current) => {
      const next = new Set(current)
      for (const row of pageRows) {
        if (allOn) next.delete(row.variantId)
        else next.add(row.variantId)
      }
      return next
    })
    setPicked((current) => {
      const next = new Map(current)
      for (const row of pageRows) {
        if (allOn) next.delete(row.variantId)
        else next.set(row.variantId, asTransferVariant(row))
      }
      return next
    })
  }, [checked])

  const clearSelection = useCallback(() => {
    setChecked(new Set())
    setPicked(new Map())
  }, [])

  const selectedVariants = useMemo(() => [...picked.values()], [picked])

  return (
    <>
      {showPageHeader ? (
        <PageHeader
          eyebrow="Warehouse"
          title="Stock by variant"
          description="Every color and size with its five balances. Available is what can be sold or sent."
          actions={
            <button type="button" className="btn btn-secondary" disabled={!rows?.length} onClick={() => rows && exportRows(rows)}>
              <Download size={16} aria-hidden="true" />
              Export CSV
            </button>
          }
        />
      ) : null}

      <MotionSwap state={isPending ? 'loading' : isError ? 'error' : 'ready'}>
        {isPending ? (
          <Skeleton rows={4} stats={5} />
        ) : isError ? (
          <ErrorState title="Could not load inventory" error={error} onRetry={() => void refetch()} />
        ) : (
          <div className="stack">
            <BalanceTiles totals={totals} />
            <div className="split inventory-split">
              <Panel
                title="Variants inventory ledger"
                description={`${total} ${total === 1 ? 'variant' : 'variants'} in this scope`}
                className="inventory-ledger-panel"
              >
                <div className="toolbar">
                  <SearchInput
                    ref={searchRef}
                    value={searchInput}
                    onChange={(value) => {
                      setSearchInput(value)
                      setPage(1)
                    }}
                    placeholder="Search model, code, SKU, color or size (press /)"
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
                {mayTransfer && selectedVariants.length > 0 && (
                  <div className="bulk-bar" role="status">
                    <span>
                      <strong className="tabular">{selectedVariants.length}</strong>{' '}
                      {selectedVariants.length === 1 ? 'variant' : 'variants'} selected
                    </span>
                    <div className="bulk-bar-actions">
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => setSending(selectedVariants)}>
                        <ArrowLeftRight size={14} aria-hidden="true" />
                        Send as one shipment
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={clearSelection}>
                        Clear
                      </button>
                    </div>
                  </div>
                )}
                <InventoryTable
                  rows={visible}
                  dataset={`${scope}-${currentPage}`}
                  totals={totals}
                  selectedId={highlightedId}
                  onSelect={(row) => setSelectedId(row.variantId)}
                  filtered={filtered}
                  onCorrect={mayCorrect ? (row) => setCorrecting(row) : undefined}
                  onTransfer={mayTransfer ? (row) => setSending([asTransferVariant(row)]) : undefined}
                  checked={mayTransfer ? checked : undefined}
                  onToggle={mayTransfer ? toggle : undefined}
                  onToggleAll={mayTransfer ? toggleAll : undefined}
                />
                <Pagination page={currentPage} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
              </Panel>
              <aside className="split-aside inventory-split-aside" aria-label="Transfers activity">
                <TransfersActivityPanel />
              </aside>
            </div>
          </div>
        )}
      </MotionSwap>

      {correcting && (
        <CorrectStockDrawer
          variantId={correcting.variantId}
          label={variantLabel(correcting)}
          code={correcting.sku}
          initialBranchId={scopedBranchId}
          onClose={() => setCorrecting(null)}
        />
      )}

      {sending && sending.length > 0 && (
        <QuickTransferDrawer
          variants={sending}
          initialSourceId={scopedBranchId}
          onClose={() => setSending(null)}
          onDone={clearSelection}
        />
      )}
    </>
  )
}
