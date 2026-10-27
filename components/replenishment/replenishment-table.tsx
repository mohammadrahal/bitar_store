'use client'

import Link from 'next/link'
import { QuantityInput } from '@/components/shared/quantity-input'
import type { ReplenishmentRow } from '@/types'

/**
 * Two branches asking for the same variant share one warehouse shelf, so each
 * row's cap is what the warehouse has minus what other rows already took.
 */
export function ReplenishmentTable({
  rows,
  picked,
  keyOf,
  onChange,
}: {
  rows: ReplenishmentRow[]
  picked: Record<string, number>
  keyOf: (row: ReplenishmentRow) => string
  onChange: (key: string, quantity: number) => void
}) {
  const capOf = (row: ReplenishmentRow) => {
    const others = rows
      .filter((other) => other.variantId === row.variantId && keyOf(other) !== keyOf(row))
      .reduce((sum, other) => sum + (picked[keyOf(other)] ?? 0), 0)
    return Math.max(0, row.warehouseAvailable - others)
  }

  return (
    <div className="table-wrap">
      <table className="card-table">
        <caption className="sr-only">Replenishment suggestions</caption>
        <thead>
          <tr>
            <th scope="col"><span className="sr-only">Select</span></th>
            <th scope="col">Variant</th>
            <th scope="col">Branch</th>
            <th scope="col" className="num">Available</th>
            <th scope="col" className="num">In transit</th>
            <th scope="col" className="num">Threshold</th>
            <th scope="col" className="num">Send</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = keyOf(row)
            const value = picked[key] ?? 0
            const cap = capOf(row)
            return (
              <tr key={key} className={value > 0 ? 'selected' : ''}>
                <td>
                  <input
                    type="checkbox"
                    className="row-check"
                    checked={value > 0}
                    disabled={cap === 0 && value === 0}
                    aria-label={`Select ${row.productName} ${row.color} / ${row.size} for ${row.branchName}`}
                    onChange={(event) => onChange(key, event.target.checked ? Math.min(row.suggested, cap) : 0)}
                  />
                </td>
                <td className="card-title">
                  <Link href={`/inventory/${row.variantId}`} className="link-cell">
                    {row.productName} {row.color} / {row.size}
                  </Link>
                  <small className="tabular">{row.sku} · suggest {row.suggested}</small>
                </td>
                <td data-label="Branch">{row.branchName}</td>
                <td className="num tabular" data-label="Available">{row.available}</td>
                <td className="num tabular" data-label="In transit">{row.inTransit}</td>
                <td className="num tabular" data-label="Threshold">{row.lowStockAt}</td>
                <td className="num" data-label="Send">
                  {cap === 0 && value === 0 ? (
                    <small className="qty-hint at-cap">None at warehouse</small>
                  ) : (
                    <QuantityInput
                      value={value}
                      max={cap}
                      capLabel="at warehouse"
                      label={`Units to send to ${row.branchName}`}
                      onChange={(quantity) => onChange(key, quantity)}
                    />
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
