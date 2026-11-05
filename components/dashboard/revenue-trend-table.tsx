'use client'

import { Pagination } from '@/components/shared/pagination'
import { usePagination } from '@/hooks/use-pagination'
import { formatNumber, formatPrice } from '@/lib/format'
import type { TrendPoint } from '@/services/dashboard-trend.service'

/**
 * The trend's figures as numbers: the route to every per-day value that does
 * not depend on hovering a chart. Newest first, which is the order someone
 * reading a table of recent days wants.
 */
export function RevenueTrendTable({ points }: { points: TrendPoint[] }) {
  const newestFirst = [...points].reverse()
  const { visible, page, pageCount, total, pageSize, setPage } = usePagination(newestFirst, 10)

  return (
    <>
      <div className="table-wrap">
        <table>
          <caption className="sr-only">Revenue and sales by day</caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col" className="num">
                Sales
              </th>
              <th scope="col" className="num">
                Revenue
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((point) => (
              <tr key={point.day}>
                <td>
                  <strong>{point.day}</strong>
                </td>
                <td className="num tabular">{formatNumber(point.sales)}</td>
                <td className="num tabular">{formatPrice(point.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageCount={pageCount} total={total} pageSize={pageSize} onPage={setPage} />
    </>
  )
}
