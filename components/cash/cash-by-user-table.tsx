'use client'

import { Panel } from '@/components/shared/panel'
import { priceOf } from '@/lib/api/map-catalog'
import { formatNumber, formatPrice } from '@/lib/format'
import type { ApiCashSessionByUser } from '@/lib/api/types'

/**
 * Who sold what during the session.
 *
 * Cash and Whish are shown in separate columns and never totalled together
 * here: only the cash column has anything to do with the drawer being counted.
 */
export function CashByUserTable({ rows }: { rows: ApiCashSessionByUser[] }) {
  if (rows.length === 0) return null

  return (
    <Panel
      title="Who sold what"
      description="Sales rung up on this session, by the person who took them."
      headingLevel={2}
    >
      <div className="table-wrap">
        <table className="card-table">
          <caption className="sr-only">Sales on this session by user</caption>
          <thead>
            <tr>
              <th scope="col">Person</th>
              <th scope="col" className="num">
                Sales
              </th>
              <th scope="col" className="num">
                Rung up
              </th>
              <th scope="col" className="num">
                Cash
              </th>
              <th scope="col" className="num">
                Whish
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.user.id}>
                <td className="card-title">{row.user.name ?? 'Unknown'}</td>
                <td className="num tabular">{formatNumber(row.salesCount)}</td>
                <td className="num tabular">{formatPrice(priceOf(row.salesTotal))}</td>
                <td className="num tabular">{formatPrice(priceOf(row.cashPayments))}</td>
                <td className="num tabular">{formatPrice(priceOf(row.whishPayments))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
