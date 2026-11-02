'use client'

import { useState } from 'react'
import { Boxes } from 'lucide-react'
import { MotionTbody, MotionTr } from '@/components/motion/motion-table'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { Pagination } from '@/components/shared/pagination'
import { SearchInput } from '@/components/shared/search-input'
import { Skeleton } from '@/components/shared/skeleton'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useStockNetwork } from '@/hooks/use-warehouse'
import { formatNumber } from '@/lib/format'

const PAGE_SIZE = 50

export function StockNetworkView() {
  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput)
  const [page, setPage] = useState(1)
  const offset = (page - 1) * PAGE_SIZE

  const query = useStockNetwork(search, offset)
  const locations = query.data?.locations ?? []
  const items = query.data?.items ?? []
  const itemCount = items.length
  const pages = itemCount < PAGE_SIZE && page === 1 ? 1 : page + (itemCount >= PAGE_SIZE ? 1 : 0)

  return (
    <>
      <PageHeader
        eyebrow="Warehouse"
        title="Stock everywhere"
        description="Every active place at once: warehouse first, then branches. Admin only on the server."
      />

      <Panel title="Network balances">
        <div className="toolbar">
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search SKU or style"
            aria-label="Search network stock"
          />
        </div>

        {query.isPending ? (
          <div className="panel-body">
            <Skeleton rows={6} stats={0} />
          </div>
        ) : query.isError ? (
          <div className="panel-body">
            <ErrorState title="Could not load network stock" error={query.error} onRetry={() => void query.refetch()} />
          </div>
        ) : items.length === 0 ? (
          <div className="panel-body">
            <EmptyState icon={Boxes} title="No variants match" description="Try another search term." />
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="card-table">
                <caption className="sr-only">Sellable stock by location</caption>
                <thead>
                  <tr>
                    <th scope="col">SKU</th>
                    <th scope="col" className="num">
                      Total sellable
                    </th>
                    {locations.map((place) => (
                      <th key={place.id} scope="col" className="num">
                        {place.code}
                      </th>
                    ))}
                  </tr>
                </thead>
                <MotionTbody dataset={`${search}-${page}`}>
                  {items.map((item, index) => (
                    <MotionTr key={item.sku.id} index={index}>
                      <td className="card-title">
                        <strong>{item.sku.skuCode}</strong>
                        <small>{item.sku.style.name}</small>
                      </td>
                      <td className="num">{formatNumber(item.totals.sellable)}</td>
                      {item.locations.map((cell) => (
                        <td key={cell.branchId} className={`num ${cell.belowMinimum ? 'cell-alert' : ''}`}>
                          {formatNumber(cell.sellable)}
                        </td>
                      ))}
                    </MotionTr>
                  ))}
                </MotionTbody>
              </table>
            </div>
            {itemCount >= PAGE_SIZE && (
              <Pagination
                page={page}
                pageCount={pages}
                total={page * PAGE_SIZE + (itemCount >= PAGE_SIZE ? 1 : 0)}
                pageSize={PAGE_SIZE}
                onPage={setPage}
              />
            )}
          </>
        )}
      </Panel>
    </>
  )
}
