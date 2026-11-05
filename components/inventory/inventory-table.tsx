'use client'

import Link from 'next/link'
import { PackageSearch, Plus } from 'lucide-react'
import { MotionTbody, MotionTr } from '@/components/motion/motion-table'
import { EmptyState } from '@/components/shared/empty-state'
import { SortableTh } from '@/components/shared/sortable-th'
import { StockBadge } from '@/components/shared/stock-badge'
import { VariantCell } from '@/components/shared/variant-cell'
import { useSortedRows, type SortAccessors } from '@/hooks/use-sorted-rows'
import { balanceText } from '@/lib/balances'
import { formatNumber } from '@/lib/format'
import type { Balances, InventoryRow } from '@/types'

const COLUMNS: { key: keyof Balances; label: string }[] = [
  { key: 'onHand', label: 'On hand' },
  { key: 'reserved', label: 'Reserved' },
  { key: 'onHold', label: 'On hold' },
  { key: 'available', label: 'Available' },
  { key: 'inTransit', label: 'In transit' },
]

type SortKey = 'variant' | 'code' | 'status' | keyof Balances

const cell = (value: number | null) => balanceText(value, formatNumber)

/** Most urgent first, so sorting by status puts what needs acting on at the top. */
const STATUS_ORDER: Record<InventoryRow['status'], number> = {
  out: 0,
  low: 1,
  in_transit: 2,
  on_hold: 3,
  in_stock: 4,
  archived: 5,
}

export function InventoryTable({
  rows,
  totals,
  selectedId,
  onSelect,
  filtered,
  dataset,
}: {
  rows: InventoryRow[]
  /** Totals over every row that matched, not just this page. */
  totals: Balances
  selectedId: string | null
  onSelect: (row: InventoryRow) => void
  filtered: boolean
  /** Names the scope and page on screen, so the entrance plays once per set. */
  dataset?: string
}) {
  const accessors: SortAccessors<InventoryRow, SortKey> = {
    variant: (row) => `${row.productName} ${row.color} ${row.size}`,
    code: (row) => row.sku,
    status: (row) => STATUS_ORDER[row.status],
    onHand: (row) => row.onHand,
    nonSellable: (row) => row.nonSellable,
    reserved: (row) => row.reserved,
    onHold: (row) => row.onHold,
    available: (row) => row.available,
    inTransit: (row) => row.inTransit,
  }
  const sort = useSortedRows<InventoryRow, SortKey>(
    rows,
    accessors,
    { key: 'variant', direction: 'asc' },
    ['onHand', 'nonSellable', 'reserved', 'onHold', 'available', 'inTransit'],
  )
  const visible = sort.rows ?? []

  if (rows.length === 0) {
    return (
      <div className="panel-body">
        <EmptyState
          icon={PackageSearch}
          title={filtered ? 'No variants match' : 'No variants yet'}
          description={
            filtered
              ? 'Try another search or filter.'
              : 'Variants appear here once a product has colours and sizes.'
          }
          action={
            filtered ? undefined : (
              <Link href="/products/new" className="btn btn-primary">
                <Plus size={16} aria-hidden="true" />
                New product
              </Link>
            )
          }
        />
      </div>
    )
  }

  return (
    <div className="table-wrap">
      <table className="card-table">
        <caption className="sr-only">Stock by variant. Select a row to see it by location.</caption>
        <thead>
          <tr>
            <SortableTh columnKey="variant" label="Variant" sort={sort} />
            <SortableTh columnKey="code" label="SKU" sort={sort} />
            {COLUMNS.map((column) => (
              <SortableTh key={column.key} columnKey={column.key} label={column.label} sort={sort} numeric />
            ))}
            <SortableTh columnKey="status" label="Status" sort={sort} />
          </tr>
        </thead>
        <MotionTbody dataset={dataset}>
          {visible.map((row, index) => (
            <MotionTr
              key={row.variantId}
              className={`row-button ${row.variantId === selectedId ? 'selected' : ''}`}
              index={index}
            >
              <td className="card-title">
                {/* Selecting shows the variant across locations in the aside;
                    the SKU below is the same identity the API uses. */}
                <button
                  type="button"
                  className="link-cell"
                  onClick={() => onSelect(row)}
                  aria-pressed={row.variantId === selectedId}
                >
                  <strong>{[row.productName, row.color, row.size].filter(Boolean).join(' · ')}</strong>
                </button>
                <small>{row.category}</small>
              </td>
              <td className="td-code tabular" data-label="SKU">
                {row.sku}
              </td>
              {COLUMNS.map((column) => (
                <td key={column.key} className="num tabular" data-label={column.label}>
                  {column.key === 'available' ? <strong>{cell(row[column.key])}</strong> : cell(row[column.key])}
                </td>
              ))}
              <td data-label="Status">
                <StockBadge row={row} />
              </td>
            </MotionTr>
          ))}
        </MotionTbody>
        <tfoot>
          <tr>
            <td className="card-title">Totals</td>
            <td />
            {COLUMNS.map((column) => (
              <td key={column.key} className="num tabular" data-label={column.label}>
                {cell(totals[column.key])}
              </td>
            ))}
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
