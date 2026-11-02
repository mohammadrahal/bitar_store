'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeftRight, Plus } from 'lucide-react'
import { TransferStatusPill } from '@/components/transfers/transfer-status-pill'
import { MotionTbody, MotionTr } from '@/components/motion/motion-table'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { FilterChips, type ChipOption } from '@/components/shared/filter-chips'
import { LocationSelect } from '@/components/shared/location-select'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { Pagination } from '@/components/shared/pagination'
import { Skeleton } from '@/components/shared/skeleton'
import { useDefaultBranchId } from '@/hooks/use-branch-scope'
import { usePermission } from '@/hooks/use-permission'
import { useTransfersList } from '@/hooks/use-transfers'
import type { TransferStatus } from '@/lib/api/types'

const STATUSES: ChipOption<TransferStatus | 'all'>[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'dispatched', label: 'On the road' },
  { value: 'partially_received', label: 'Partly received' },
  { value: 'received', label: 'Received' },
  { value: 'closed', label: 'Closed' },
]

export function TransfersView() {
  const { canDispatchTransfers, canRequestTransfer, locationScoped } = usePermission()
  const requestOnly = canRequestTransfer() && !canDispatchTransfers()
  const defaultBranch = useDefaultBranchId()
  const [branchId, setBranchId] = useState(locationScoped ? defaultBranch : '')
  const [status, setStatus] = useState<TransferStatus | 'all'>('all')
  const [page, setPage] = useState(1)
  const offset = (page - 1) * 20

  const query = useTransfersList(branchId, status === 'all' ? '' : status, offset)
  const total = query.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / 20))
  const items = query.data?.items ?? []

  return (
    <>
      <PageHeader
        eyebrow="Warehouse"
        title={requestOnly ? 'Stock requests & incoming' : 'Transfers'}
        description={
          requestOnly
            ? 'Replenishment you asked for and shipments still on the way to your branch.'
            : 'Stock moving between the warehouse and branches, or between shops.'
        }
        actions={
          canRequestTransfer() ? (
            <Link href="/transfers/new" className="btn btn-primary">
              <Plus size={16} aria-hidden="true" />
              {requestOnly ? 'Request replenishment' : 'Prepare transfer'}
            </Link>
          ) : undefined
        }
      />

      <Panel title="Transfer list" description={query.isPending ? undefined : `${total} transfers`}>
        <div className="toolbar">
          {!locationScoped && (
            <div className="toolbar-field">
              <LocationSelect
                value={branchId}
                onChange={(value) => {
                  setBranchId(value)
                  setPage(1)
                }}
                onlyAccessible
                placeholder="All locations"
                aria-label="Filter by location"
              />
            </div>
          )}
          <FilterChips
            label="Status"
            options={STATUSES}
            value={status}
            onChange={(value) => {
              setStatus(value)
              setPage(1)
            }}
          />
        </div>

        {query.isPending ? (
          <div className="panel-body">
            <Skeleton rows={4} stats={0} />
          </div>
        ) : query.isError ? (
          <div className="panel-body">
            <ErrorState title="Could not load transfers" error={query.error} onRetry={() => void query.refetch()} />
          </div>
        ) : items.length === 0 ? (
          <div className="panel-body">
            <EmptyState
              icon={ArrowLeftRight}
              title="No transfers match"
              description="Try another status filter or prepare a new shipment."
              action={
                canRequestTransfer() ? (
                  <Link href="/transfers/new" className="btn btn-primary">
                    {requestOnly ? 'Request replenishment' : 'Prepare transfer'}
                  </Link>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="card-table">
                <caption className="sr-only">Stock transfers</caption>
                <thead>
                  <tr>
                    <th scope="col">Reference</th>
                    <th scope="col">From</th>
                    <th scope="col">To</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="num">
                      Pieces
                    </th>
                    <th scope="col" className="num">
                      On the road
                    </th>
                  </tr>
                </thead>
                <MotionTbody dataset={`${branchId}-${status}-${page}`}>
                  {items.map((transfer, index) => (
                    <MotionTr key={transfer.id} index={index}>
                      <td className="card-title">
                        <Link href={`/transfers/${transfer.id}`} className="link-cell">
                          {transfer.reference}
                        </Link>
                      </td>
                      <td>{transfer.from.name}</td>
                      <td>{transfer.to.name}</td>
                      <td>
                        <TransferStatusPill status={transfer.status} />
                      </td>
                      <td className="num">{transfer.totals.dispatched || transfer.totals.requested}</td>
                      <td className="num">{transfer.totals.onTheRoad}</td>
                    </MotionTr>
                  ))}
                </MotionTbody>
              </table>
            </div>
            {total > 20 && (
              <Pagination page={page} pageCount={pages} total={total} pageSize={20} onPage={setPage} />
            )}
          </>
        )}
      </Panel>
    </>
  )
}
