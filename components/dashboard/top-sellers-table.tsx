'use client'

import { formatNumber, formatPrice } from '@/lib/format'
import type { SalesAnalytics } from '@/types'

/** The chart's data as numbers: the accessible route to the same figures. */
export function TopSellersTable({ analytics }: { analytics: SalesAnalytics }) {
  const { series, topProducts } = analytics
  const perBranch = series.length > 1

  return (
    <div className="table-wrap">
      <table>
        <caption className="sr-only">Top products by units sold</caption>
        <thead>
          <tr>
            <th scope="col">Product</th>
            {perBranch &&
              series.map((entry) => (
                <th key={entry.id} scope="col" className="num">
                  {entry.name}
                </th>
              ))}
            <th scope="col" className="num">
              Units
            </th>
            <th scope="col" className="num">
              Revenue
            </th>
          </tr>
        </thead>
        <tbody>
          {topProducts.map((product) => (
            <tr key={product.productName}>
              <td>
                <strong>{product.productName}</strong>
              </td>
              {perBranch &&
                series.map((entry) => (
                  <td key={entry.id} className="num tabular">
                    {formatNumber(product.byBranch[entry.id] ?? 0)}
                  </td>
                ))}
              <td className="num tabular">
                <strong>{formatNumber(product.units)}</strong>
              </td>
              <td className="num tabular">{formatPrice(product.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
