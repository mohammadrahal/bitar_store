'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeftRight, Plus } from 'lucide-react'
import { TransferStatusPill } from '@/components/transfers/transfer-status-pill'
import { Can } from '@/components/shared/can'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { FilterChips, type ChipOption } from '@/components/shared/filter-chips'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useBranchScope } from '@/hooks/use-branch-scope'
import { useTransfers } from '@/hooks/use-transfers'
import { formatNumber, formatRelativeDateTime } from '@/lib/format'
import { TRANSFER_STATUS_LABELS, TRANSFER_STATUSES } from '@/lib/transfers'
import type { TransferQuery } from '@/services/transfers.service'

type StatusFilter = TransferQuery['status']

const FILTERS: ChipOption<StatusFilter>[] = [
  { value: 'open', label: 'Open' },
  ...TRANSFER_STATUSES.map((status) => ({ value: status, label: TRANSFER_STATUS_LABELS[status] })),
  { value: 'all', label: 'All' },
]

export function TransfersView() {
  const scope = useBranchScope()
  const [status, setStatus] = useState<StatusFilter>('open')
  const { data: transfers, isPending, isError, error, refetch } = useTransfers({ scope, status })

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Transfers"
        description="Stock moving between locations. Approving reserves it, dispatching puts it in transit, receiving makes it sellable."
        actions={
          <Can action="transfers:request">
            <Link href="/transfers/new" className="btn btn-primary">
              <Plus size={16} aria-hidden="true" />
              New transfer
            </Link>
          </Can>
        }
      />
      <Panel title="Transfers" description={isPending ? 'Loading…' : `${transfers?.length ?? 0} shown`}>
        <div className="toolbar">
          <FilterChips label="Filter by status" options={FILTERS} value={status} onChange={setStatus} />
        </div>
        {isPending ? (
          <div className="panel-body">
            <Skeleton rows={3} stats={0} />
          </div>
        ) : isError ? (
          <div className="panel-body">
            <ErrorState title="Could not load transfers" error={error} onRetry={() => void refetch()} />
          </div>
        ) : transfers.length === 0 ? (
          <div className="panel-body">
            <EmptyState
              icon={ArrowLeftRight}
              title={status === 'open' ? 'No open transfers' : 'No transfers here'}
              description="Requests, dispatches and receipts for your locations will show up here."
            />
          </div>
        ) : (
          <div className="table-wrap">
            <table className="card-table">
              <caption className="sr-only">Transfers, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Transfer</th>
                  <th scope="col">Route</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="num">Requested</th>
                  <th scope="col" className="num">Dispatched</th>
                  <th scope="col" className="num">Received</th>
                  <th scope="col" className="num">In transit</th>
                  <th scope="col">Updated</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((transfer) => (
                  <tr key={transfer.id}>
                    <td className="card-title">
                      <Link href={`/transfers/${transfer.id}`} className="link-cell tabular">
                        {transfer.number}
                      </Link>
                      <small>{transfer.lines.length} {transfer.lines.length === 1 ? 'variant' : 'variants'}</small>
                    </td>
                    <td data-label="Route">
                      {transfer.fromName} → {transfer.toName}
                    </td>
                    <td data-label="Status">
                      <TransferStatusPill status={transfer.status} />
                    </td>
                    <td className="num tabular" data-label="Requested">{formatNumber(transfer.totals.requested)}</td>
                    <td className="num tabular" data-label="Dispatched">{formatNumber(transfer.totals.dispatched)}</td>
                    <td className="num tabular" data-label="Received">{formatNumber(transfer.totals.received)}</td>
                    <td className="num tabular" data-label="In transit">{formatNumber(transfer.totals.inTransit)}</td>
                    <td className="tabular" data-label="Updated">{formatRelativeDateTime(transfer.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  )
}
