'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeftRight, ArrowUpRight } from 'lucide-react'
import { TransferStatusPill } from '@/components/transfers/transfer-status-pill'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { FilterChips, type ChipOption } from '@/components/shared/filter-chips'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useEffectiveListBranchId } from '@/hooks/use-branch-scope'
import { usePermission } from '@/hooks/use-permission'
import { useTransfersList } from '@/hooks/use-transfers'
import type { TransferStatus } from '@/lib/api/types'

const FILTERS: ChipOption<TransferStatus | 'all'>[] = [
  { value: 'all', label: 'All' },
  { value: 'dispatched', label: 'On road' },
  { value: 'partially_received', label: 'Partly received' },
  { value: 'received', label: 'Received' },
  { value: 'closed', label: 'Closed' },
]

const PEEK = 8

/**
 * The transfers column on the inventory hub: recent movements beside the variant
 * ledger, matching the multi-location overview layout.
 */
export function TransfersActivityPanel() {
  const { canSeeTransfers } = usePermission()
  const branchId = useEffectiveListBranchId('')
  const [status, setStatus] = useState<TransferStatus | 'all'>('all')
  const query = useTransfersList(branchId, status === 'all' ? '' : status, 0)

  if (!canSeeTransfers()) return null

  const items = query.data?.items.slice(0, PEEK) ?? []

  return (
    <Panel
      title="Transfers activity"
      headingLevel={3}
      description={query.data ? `${query.data.total} in this view` : undefined}
      className="inventory-transfers-feed overview-feed-panel"
      actions={
        <Link href="/transfers" className="overview-panel-link">
          View all
          <ArrowUpRight size={14} aria-hidden="true" />
        </Link>
      }
    >
      <div className="inventory-transfers-feed-toolbar panel-body panel-body--tight">
        <FilterChips
          label="Transfer status"
          options={FILTERS}
          value={status}
          onChange={(value) => setStatus(value)}
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
            title="No transfers here"
            description="Try another status or prepare a new shipment."
            action={
              <Link href="/transfers/new" className="btn btn-primary btn-sm">
                Prepare transfer
              </Link>
            }
          />
        </div>
      ) : (
        <ul className="inventory-transfer-cards panel-body" aria-label="Recent transfers">
          {items.map((transfer) => {
            const pieces = transfer.totals.dispatched || transfer.totals.requested
            return (
              <li key={transfer.id}>
                <Link href={`/transfers/${transfer.id}`} className="inventory-transfer-card">
                  <div className="inventory-transfer-card-top">
                    <span className="inventory-transfer-ref tabular">{transfer.reference}</span>
                    <TransferStatusPill status={transfer.status} />
                  </div>
                  <p className="inventory-transfer-route">
                    {transfer.from.name}
                    <span aria-hidden="true"> → </span>
                    {transfer.to.name}
                  </p>
                  <p className="inventory-transfer-meta tabular">
                    {pieces} pcs
                    {transfer.totals.onTheRoad > 0 ? ` · ${transfer.totals.onTheRoad} on road` : ''}
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
