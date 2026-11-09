'use client'

import { useState } from 'react'
import { PackageSearch, Truck } from 'lucide-react'
import { QuickTransferDrawer, type QuickTransferVariant } from '@/components/inventory/quick-transfer-drawer'
import { MotionTbody, MotionTr } from '@/components/motion/motion-table'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { LocationSelect } from '@/components/shared/location-select'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { SkuTableCell } from '@/components/shared/table-empty'
import { useAllowPageBranchFilter, useEffectiveListBranchId } from '@/hooks/use-branch-scope'
import { Pagination } from '@/components/shared/pagination'
import { usePagination } from '@/hooks/use-pagination'
import { usePermission } from '@/hooks/use-permission'
import { useReplenishment } from '@/hooks/use-warehouse'
import { formatNumber } from '@/lib/format'
import { variantLabel } from '@/lib/variant-label'

/** What one suggestion becomes when it is sent: the row, already filled in. */
interface Fill {
  variant: QuickTransferVariant
  destinationId: string
  quantity: number
}

export function ReplenishmentView({ embedded = false }: { embedded?: boolean } = {}) {
  const allowPageBranchFilter = useAllowPageBranchFilter()
  const [pageBranchId, setPageBranchId] = useState('')
  const branchId = useEffectiveListBranchId(pageBranchId)
  const { canRequestTransfer } = usePermission()

  const query = useReplenishment(branchId)
  const rows = query.data?.suggestions ?? []
  const pagination = usePagination(rows, 20, branchId)
  const warehouseId = query.data?.warehouse?.id
  /**
   * Filling a suggestion used to mean a blank `/transfers/new`: the branch, the
   * variant and the quantity were all on the row being read and all three had
   * to be found again by hand. This hands the same three to the drawer, which
   * is the only screen involved now.
   */
  const [filling, setFilling] = useState<Fill | null>(null)

  return (
    <>
      {!embedded ? (
        <PageHeader
          eyebrow="Warehouse"
          title="What to send"
          description="Branches below their minimum, ranked by need. Fillable is what the warehouse can ship now."
        />
      ) : null}

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
        {allowPageBranchFilter && (
          <div className="toolbar">
            <div className="toolbar-field toolbar-field-grow">
              <LocationSelect
                value={pageBranchId}
                onChange={setPageBranchId}
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
                      {row.fillable > 0 && canRequestTransfer() ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          title={`Send ${formatNumber(Math.min(row.suggested, row.fillable))} to ${row.branch.name}`}
                          onClick={() =>
                            setFilling({
                              variant: {
                                variantId: row.sku.id,
                                label: variantLabel({
                                  productName: row.sku.styleName,
                                  color: row.sku.color,
                                  size: row.sku.size,
                                }),
                                sku: row.sku.code,
                              },
                              destinationId: row.branch.id,
                              /* The warehouse cannot send what it has not got,
                                 so the suggestion is capped at what is fillable
                                 before anyone sees it. */
                              quantity: Math.max(1, Math.min(row.suggested, row.fillable)),
                            })
                          }
                        >
                          <Truck size={14} aria-hidden="true" />
                          Send
                        </button>
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

      {filling && (
        <QuickTransferDrawer
          variants={[filling.variant]}
          initialSourceId={warehouseId}
          initialDestinationId={filling.destinationId}
          initialQuantities={{ [filling.variant.variantId]: filling.quantity }}
          onClose={() => setFilling(null)}
          onDone={() => void query.refetch()}
        />
      )}
    </>
  )
}
