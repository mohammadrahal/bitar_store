'use client'

import Link from 'next/link'
import { ArrowLeftRight, ClipboardCheck, History, PackageSearch, Plus } from 'lucide-react'
import { MotionTbody, MotionTr } from '@/components/motion/motion-table'
import { EmptyState } from '@/components/shared/empty-state'
import { SortableTh } from '@/components/shared/sortable-th'
import { StockBadge } from '@/components/shared/stock-badge'
import { VariantCell } from '@/components/shared/variant-cell'
import { useSortedRows, type SortAccessors } from '@/hooks/use-sorted-rows'
import { balanceText } from '@/lib/balances'
import { formatNumber } from '@/lib/format'
import { inventoryHref, inventoryVariantHref } from '@/lib/inventory-filters'
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
  onCorrect,
  onTransfer,
  checked,
  onToggle,
  onToggleAll,
}: {
  rows: InventoryRow[]
  /** Totals over every row that matched, not just this page. */
  totals: Balances
  selectedId: string | null
  onSelect: (row: InventoryRow) => void
  filtered: boolean
  /** Names the scope and page on screen, so the entrance plays once per set. */
  dataset?: string
  /**
   * The two operations a row leads to, given only when the viewer may run them.
   * They open a drawer over this list rather than a page, so the work happens
   * where the decision was made and the scroll position survives it.
   */
  onCorrect?: (row: InventoryRow) => void
  onTransfer?: (row: InventoryRow) => void
  /** Variant ids ticked for a batch send. Absent means no checkbox column. */
  checked?: ReadonlySet<string>
  onToggle?: (row: InventoryRow) => void
  /** Ticks or clears every row on this page. */
  onToggleAll?: (rows: InventoryRow[]) => void
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
  const selectable = Boolean(onToggle)
  const actionable = Boolean(onCorrect || onTransfer)
  const allChecked = selectable && visible.length > 0 && visible.every((row) => checked?.has(row.variantId))

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
        <caption className="sr-only">
          Stock by variant. Select a row to see it by location; each row carries its own correct and send actions.
        </caption>
        <thead>
          <tr>
            {selectable && (
              <th scope="col" className="th-select">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={() => onToggleAll?.(visible)}
                  aria-label={allChecked ? 'Clear the selection' : 'Select every variant on this page'}
                />
              </th>
            )}
            <SortableTh columnKey="variant" label="Variant & details" sort={sort} />
            <SortableTh columnKey="code" label="SKU / barcode" sort={sort} />
            {COLUMNS.map((column) => (
              <SortableTh key={column.key} columnKey={column.key} label={column.label} sort={sort} numeric />
            ))}
            <SortableTh columnKey="status" label="Status" sort={sort} />
            {actionable && (
              <th scope="col" className="num">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <MotionTbody dataset={dataset}>
          {visible.map((row, index) => (
            <MotionTr
              key={row.variantId}
              className={`row-button ${row.variantId === selectedId ? 'selected' : ''}`}
              index={index}
            >
              {selectable && (
                <td className="td-select">
                  <input
                    type="checkbox"
                    checked={checked?.has(row.variantId) ?? false}
                    onChange={() => onToggle?.(row)}
                    aria-label={`Select ${[row.productName, row.color, row.size].filter(Boolean).join(' ')}`}
                  />
                </td>
              )}
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
              {COLUMNS.map((column) => {
                const amount = row[column.key]
                const showHoldLink = column.key === 'onHold' && (amount ?? 0) > 0
                return (
                  <td key={column.key} className="num tabular" data-label={column.label}>
                    {showHoldLink ? (
                      <Link
                        href={inventoryVariantHref(row.variantId, 'on_hold')}
                        className="text-link tabular"
                        title={`View ${row.sku} on hold by location`}
                      >
                        {cell(amount)}
                      </Link>
                    ) : column.key === 'available' ? (
                      <strong className="ledger-available">{cell(amount)}</strong>
                    ) : (
                      cell(amount)
                    )}
                  </td>
                )
              })}
              <td data-label="Status">
                <StockBadge row={row} />
              </td>
              {actionable && (
                <td className="td-row-actions">
                  <div className="row-actions">
                    {onTransfer && (
                      <button
                        type="button"
                        className="icon-btn"
                        title={`Send ${row.sku} to another location`}
                        onClick={() => onTransfer(row)}
                        disabled={row.archived}
                      >
                        <ArrowLeftRight size={16} aria-hidden="true" />
                        <span className="sr-only">Send stock</span>
                      </button>
                    )}
                    {onCorrect && (
                      <button
                        type="button"
                        className="icon-btn"
                        title={`Correct the balance for ${row.sku}`}
                        onClick={() => onCorrect(row)}
                      >
                        <ClipboardCheck size={16} aria-hidden="true" />
                        <span className="sr-only">Correct stock</span>
                      </button>
                    )}
                    <Link
                      href={inventoryVariantHref(row.variantId)}
                      className="icon-btn"
                      title={`Movement history for ${row.sku}`}
                    >
                      <History size={16} aria-hidden="true" />
                      <span className="sr-only">Movement history</span>
                    </Link>
                  </div>
                </td>
              )}
            </MotionTr>
          ))}
        </MotionTbody>
        <tfoot>
          <tr>
            {selectable && <td className="td-select" />}
            <td className="card-title">Totals</td>
            <td />
            {COLUMNS.map((column) => {
              const amount = totals[column.key]
              const showHoldLink = column.key === 'onHold' && (amount ?? 0) > 0
              return (
                <td key={column.key} className="num tabular" data-label={column.label}>
                  {showHoldLink ? (
                    <Link href={inventoryHref('on_hold')} className="text-link tabular" title="View all variants on hold">
                      {cell(amount)}
                    </Link>
                  ) : (
                    cell(amount)
                  )}
                </td>
              )
            })}
            <td />
            {actionable && <td />}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
