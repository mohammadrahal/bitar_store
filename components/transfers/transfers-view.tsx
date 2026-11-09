'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
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
import { useAllowPageBranchFilter, useEffectiveListBranchId } from '@/hooks/use-branch-scope'
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

const STATUS_VALUES = STATUSES.map((option) => option.value)

/** `?status=draft` so a count elsewhere can open the list already filtered. */
function parseStatus(value: string | null): TransferStatus | 'all' {
  return STATUS_VALUES.includes(value as TransferStatus) ? (value as TransferStatus) : 'all'
}

export function TransfersView({
  embedded = false,
  initialStatus,
}: {
  /** When true, skip the page chrome (used inside the inventory hub). */
  embedded?: boolean
  /** Lock the status filter (e.g. receiving tab = on the road only). */
  initialStatus?: TransferStatus
} = {}) {
  const { canDispatchTransfers, canRequestTransfer } = usePermission()
  const requestOnly = canRequestTransfer() && !canDispatchTransfers()
  const allowPageBranchFilter = useAllowPageBranchFilter()
  const searchParams = useSearchParams()
  const [pageBranchId, setPageBranchId] = useState('')
  const branchId = useEffectiveListBranchId(pageBranchId)
  const [status, setStatus] = useState<TransferStatus | 'all'>(() => {
    if (initialStatus) return initialStatus
    return parseStatus(searchParams.get('status'))
  })
  const [page, setPage] = useState(1)
  const offset = (page - 1) * 20

  useEffect(() => {
    if (!initialStatus) setStatus(parseStatus(searchParams.get('status')))
    setPage(1)
  }, [searchParams, initialStatus])

  const query = useTransfersList(branchId, status === 'all' ? '' : status, offset)
  const total = query.data?.total ?? 0
  const pages = Math.max(1, Math.ceil(total / 20))
  const items = query.data?.items ?? []

  return (
    <>
      {!embedded ? (
        <PageHeader
          eyebrow="Warehouse"
          title={requestOnly ? 'Stock requests & incoming' : 'Transfers'}
          description={
            requestOnly
              ? 'Replenishment you asked for and shipments still on the way to your branch.'
              : 'Stock moving between the warehouse and branches, or between shops.'
          }
        />
      ) : null}

      <Panel
        title="Transfer list"
        description={query.isPending ? undefined : `${total} transfers`}
        actions={
          canRequestTransfer() ? (
            <Link href="/transfers/new" className="btn btn-primary">
              <Plus size={16} aria-hidden="true" />
              {requestOnly ? 'Request replenishment' : 'Prepare transfer'}
            </Link>
          ) : undefined
        }
      >
        <div className={`toolbar${embedded ? ' toolbar--inventory-embedded' : ''}`}>
          {allowPageBranchFilter && (
            <div className="toolbar-field">
              <LocationSelect
                value={pageBranchId}
                onChange={(value) => {
                  setPageBranchId(value)
                  setPage(1)
                }}
                onlyAccessible
                placeholder="All locations"
                aria-label="Filter by location"
              />
            </div>
          )}
          {!initialStatus ? (
            <FilterChips
              label="Status"
              options={STATUSES}
              value={status}
              onChange={(value) => {
                setStatus(value)
                setPage(1)
              }}
            />
          ) : null}
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
            <ul className="doc-feed transfers-list-mobile panel-body" aria-label="Stock transfers">
              {items.map((transfer) => {
                const pieces = transfer.totals.dispatched || transfer.totals.requested
                return (
                  <li key={transfer.id} className="doc-feed-row">
                    <div className="doc-feed-head">
                      <Link href={`/transfers/${transfer.id}`} className="doc-feed-ref link-cell">
                        {transfer.reference}
                      </Link>
                      <span className="doc-feed-figure tabular">{pieces} pcs</span>
                    </div>
                    <p className="doc-feed-meta">
                      <span>
                        {transfer.from.name} → {transfer.to.name}
                      </span>
                      <span>
                        <TransferStatusPill status={transfer.status} />
                      </span>
                      {transfer.totals.onTheRoad > 0 && (
                        <span>{transfer.totals.onTheRoad} on the road</span>
                      )}
                    </p>
                  </li>
                )
              })}
            </ul>
            <div className="table-wrap transfers-table-desktop">
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
