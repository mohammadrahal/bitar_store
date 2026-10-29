'use client'

import { Can } from '@/components/shared/can'
import { formatPrice } from '@/lib/format'
import { lineTotal } from '@/lib/invoice-totals'
import type { InvoiceLine } from '@/types'

/** The stored snapshot, not today's catalog: this is what the document says. */
export function InvoiceLinesTable({ lines }: { lines: InvoiceLine[] }) {
  return (
    <div className="table-wrap">
      <table>
        <caption className="sr-only">Document lines</caption>
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">SKU</th>
            <th scope="col" className="num">
              Qty
            </th>
            <Can permission="costs.view">
              <th scope="col" className="num">
                Unit cost
              </th>
            </Can>
            <th scope="col" className="num">
              Unit price
            </th>
            <th scope="col" className="num">
              Line total
            </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr key={line.id}>
              <td>
                <strong>{line.productName}</strong>
                <small>
                  {line.size} / {line.color}
                </small>
              </td>
              <td>{line.sku}</td>
              <td className="num tabular">{line.quantity}</td>
              <Can permission="costs.view">
                <td className="num tabular">{formatPrice(line.unitCost)}</td>
              </Can>
              <td className="num tabular">{formatPrice(line.unitPrice)}</td>
              <td className="num tabular">{formatPrice(lineTotal(line))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
