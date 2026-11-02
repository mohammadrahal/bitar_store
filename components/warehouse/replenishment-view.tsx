'use client'

import Link from 'next/link'
import { useState } from 'react'
import { PackageSearch, Truck } from 'lucide-react'
import { MotionTbody, MotionTr } from '@/components/motion/motion-table'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { LocationSelect } from '@/components/shared/location-select'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { SkuTableCell } from '@/components/shared/table-empty'
import { useDefaultBranchId } from '@/hooks/use-branch-scope'
import { usePermission } from '@/hooks/use-permission'
import { Pagination } from '@/components/shared/pagination'
import { usePagination } from '@/hooks/use-pagination'
import { useReplenishment } from '@/hooks/use-warehouse'
import { formatNumber } from '@/lib/format'

export function ReplenishmentView() {
  const { locationScoped } = usePermission()
  const defaultBranch = useDefaultBranchId()
  const [branchId, setBranchId] = useState(locationScoped ? defaultBranch : '')

  const query = useReplenishment(branchId)
  const rows = query.data?.suggestions ?? []
  const pagination = usePagination(rows, 20, branchId)

  return (
    <>
      <PageHeader
        eyebrow="Warehouse"
        title="What to send"
        description="Branches below their minimum, ranked by need. Fillable is what the warehouse can ship now."
      />

      <Panel
        title="Suggestions"
        description={
          query.data?.warehouse
            ? `Supplying from ${query.data.warehouse.name}`
            : query.data?.warehouse === null
              ? 'No warehouse configured yet'
              : undefined
        }
      >
        {!locationScoped && (
          <div className="toolbar">
            <div className="toolbar-field toolbar-field-grow">
              <LocationSelect
                value={branchId}
                onChange={setBranchId}
                onlyAccessible
                placeholder="All branches"
                aria-label="Filter by branch"
              />
            </div>
          </div>
        )}

        {query.isPending ? (
          <div className="panel-body">
            <Skeleton rows={5} stats={0} />
          </div>
        ) : query.isError ? (
          <div className="panel-body">
            <ErrorState title="Could not load suggestions" error={query.error} onRetry={() => void query.refetch()} />
          </div>
        ) : rows.length === 0 ? (
          <div className="panel-body">
            <EmptyState
              icon={PackageSearch}
              title="Nothing to send right now"
              description="Every branch you can see is at or above its minimum."
            />
          </div>
        ) : (
          <>
          <div className="table-wrap">
            <table className="card-table">
              <caption className="sr-only">Replenishment suggestions by branch and SKU</caption>
              <thead>
                <tr>
                  <th scope="col">Branch</th>
                  <th scope="col">SKU</th>
                  <th scope="col" className="num">
                    Sellable
                  </th>
                  <th scope="col" className="num">
                    In transit
                  </th>
                  <th scope="col" className="num">
                    Minimum
                  </th>
                  <th scope="col" className="num">
                    Suggested
                  </th>
                  <th scope="col" className="num">
                    Fillable
                  </th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <MotionTbody>
                {pagination.visible.map((row, index) => (
                  <MotionTr key={`${row.branch.id}-${row.sku.id}`} index={index}>
                    <td>{row.branch.name}</td>
                    <SkuTableCell
                      code={row.sku.code}
                      styleName={row.sku.styleName}
                      color={row.sku.color}
                      size={row.sku.size}
                    />
                    <td className="num">{formatNumber(row.sellable)}</td>
                    <td className="num">{formatNumber(row.inTransit)}</td>
                    <td className="num">{formatNumber(row.minQuantity)}</td>
                    <td className="num">{formatNumber(row.suggested)}</td>
                    <td className="num">{formatNumber(row.fillable)}</td>
                    <td className="row-actions">
                      {row.fillable > 0 ? (
                        <Link href="/transfers/new" className="btn btn-secondary btn-sm">
                          <Truck size={14} aria-hidden="true" />
                          Prepare
                        </Link>
                      ) : null}
                    </td>
                  </MotionTr>
                ))}
              </MotionTbody>
            </table>
          </div>
          <Pagination
            page={pagination.page}
            pageCount={pagination.pageCount}
            total={pagination.total}
            pageSize={pagination.pageSize}
            onPage={pagination.setPage}
          />
          </>
        )}
      </Panel>
    </>
  )
}
