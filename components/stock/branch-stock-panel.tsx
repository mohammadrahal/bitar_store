'use client'

import { useState } from 'react'
import { PackageSearch } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Pagination } from '@/components/shared/pagination'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { StockStatusPill } from '@/components/shared/status-pill'
import { useBranchStockRows } from '@/hooks/use-stock'
import { formatPrice } from '@/lib/format'

const PAGE_SIZE = 10

/** Everything one branch holds, from `GET /stock`. Sales move these figures. */
export function BranchStockPanel({ branchId }: { branchId: string }) {
  const { data: rows, isPending, isError, error, refetch } = useBranchStockRows(branchId)
  const [page, setPage] = useState(1)

  if (isPending) {
    return (
      <Panel title="Stock levels">
        <div className="panel-body">
          <Skeleton rows={1} stats={0} />
        </div>
      </Panel>
    )
  }

  if (isError) {
    return (
      <Panel title="Stock levels">
        <div className="panel-body">
          <ErrorState title="Could not load stock" error={error} onRetry={() => void refetch()} />
        </div>
      </Panel>
    )
  }

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <Panel title="Stock levels" description="What the server holds for this location, emptiest first.">
      {rows.length === 0 ? (
        <div className="panel-body">
          <EmptyState
            icon={PackageSearch}
            title="Nothing stocked here yet"
            description="Post an opening count for this location to bring its first units in."
          />
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <caption className="sr-only">Stock held at this branch</caption>
              <thead>
                <tr>
                  <th scope="col">Variant</th>
                  <th scope="col" className="num">
                    Price
                  </th>
                  <th scope="col" className="num">
                    On hand
                  </th>
                  <th scope="col" className="num">
                    Available
                  </th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.variantId}>
                    <td>
                      <strong>
                        {row.productName} · {row.size} / {row.color}
                      </strong>
                      <small>
                        {row.sku} · {row.barcode || row.category}
                      </small>
                    </td>
                    <td className="num tabular" data-label="Price">
                      {formatPrice(row.sellPrice)}
                    </td>
                    <td className="num tabular">{row.quantity}</td>
                    <td className="num tabular">
                      <strong>{row.available}</strong>
                    </td>
                    <td>
                      <StockStatusPill status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={currentPage}
            pageCount={pageCount}
            total={rows.length}
            pageSize={PAGE_SIZE}
            onPage={setPage}
          />
        </>
      )}
    </Panel>
  )
}
