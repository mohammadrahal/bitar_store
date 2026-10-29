'use client'

import { PackageSearch } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { StockBadge } from '@/components/shared/stock-badge'
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

/** Reserved and on hold come back null until the API can report them. */
const cell = (value: number | null) => balanceText(value, formatNumber)

export function InventoryTable({
  rows,
  totals,
  selectedId,
  onSelect,
  filtered,
}: {
  rows: InventoryRow[]
  /** Totals over every row that matched, not just this page. */
  totals: Balances
  selectedId: string | null
  onSelect: (row: InventoryRow) => void
  filtered: boolean
}) {
  if (rows.length === 0) {
    return (
      <div className="panel-body">
        <EmptyState
          icon={PackageSearch}
          title={filtered ? 'No variants match' : 'No variants yet'}
          description={filtered ? 'Try another search or filter.' : 'Create a product to start tracking its variants.'}
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
            <th scope="col">Variant</th>
            <th scope="col">Code</th>
            {COLUMNS.map((column) => (
              <th key={column.key} scope="col" className="num">
                {column.label}
              </th>
            ))}
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.variantId} className={`row-button ${row.variantId === selectedId ? 'selected' : ''}`}>
              <td className="card-title">
                <button
                  type="button"
                  className="link-cell"
                  onClick={() => onSelect(row)}
                  aria-pressed={row.variantId === selectedId}
                >
                  {row.productName} {row.color} / {row.size}
                </button>
                <small>{row.category}</small>
              </td>
              <td className="td-code" data-label="Code">
                {row.productCode} · {row.variantCode}
              </td>
              {COLUMNS.map((column) => (
                <td key={column.key} className="num tabular" data-label={column.label}>
                  {column.key === 'available' ? <strong>{cell(row[column.key])}</strong> : cell(row[column.key])}
                </td>
              ))}
              <td data-label="Status">
                <StockBadge row={row} />
              </td>
            </tr>
          ))}
        </tbody>
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
