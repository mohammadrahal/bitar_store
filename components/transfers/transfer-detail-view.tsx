'use client'

import Link from 'next/link'
import { useState } from 'react'
import { TransferStatusPill } from '@/components/transfers/transfer-status-pill'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useIdempotencyKey } from '@/hooks/use-idempotency-key'
import { usePermission } from '@/hooks/use-permission'
import {
  useCancelTransfer,
  useDispatchTransfer,
  useReceiveTransfer,
  useResolveTransfer,
  useTransfer,
} from '@/hooks/use-transfers'
import { stockShortagesOf } from '@/lib/errors'
import { Pagination } from '@/components/shared/pagination'
import { SkuTableCell } from '@/components/shared/table-empty'
import { usePagination } from '@/hooks/use-pagination'
import { formatNumber } from '@/lib/format'
import type { ApiTransferLine } from '@/lib/api/types'

function TransferLinesTable({ lines }: { lines: ApiTransferLine[] }) {
  const { visible, page, pageCount, total, pageSize, setPage } = usePagination(lines, 15)
  return (
    <>
      <div className="table-wrap">
        <table className="card-table">
          <caption className="sr-only">Transfer line quantities</caption>
          <thead>
            <tr>
              <th scope="col">SKU</th>
              <th scope="col" className="num">
                Requested
              </th>
              <th scope="col" className="num">
                Sent
              </th>
              <th scope="col" className="num">
                Received
              </th>
              <th scope="col" className="num">
                Lost
              </th>
              <th scope="col" className="num">
                On the road
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((line) => (
              <tr key={line.sku.id}>
                <SkuTableCell
                  code={line.sku.code}
                  styleName={line.sku.styleName}
                  color={line.sku.color}
                  size={line.sku.size}
                />
                <td className="num">{line.requested}</td>
                <td className="num">{line.dispatched}</td>
                <td className="num">{line.received}</td>
                <td className="num">{line.lost}</td>
                <td className="num">{line.onTheRoad}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageCount={pageCount} total={total} pageSize={pageSize} onPage={setPage} />
    </>
  )
}

export function TransferDetailView({ transferId }: { transferId: string }) {
  const { data, isPending, isError, error, refetch } = useTransfer(transferId)
  const { canDispatchTransfers, canReceiveTransfers } = usePermission()
  const dispatch = useDispatchTransfer()
  const receive = useReceiveTransfer()
  const resolve = useResolveTransfer()
  const cancel = useCancelTransfer()
  const idempotency = useIdempotencyKey()
  const [reason, setReason] = useState('')

  if (isPending) return <Skeleton rows={6} stats={0} />
  if (isError || !data)
    return <ErrorState title="Transfer unavailable" error={error} onRetry={() => void refetch()} />

  const transfer = data
  const shortage = stockShortagesOf(dispatch.error ?? receive.error)

  const receiveLines = transfer.lines
    .filter((line) => line.onTheRoad > 0)
    .map((line) => ({ skuId: line.sku.id, accepted: line.onTheRoad, damaged: 0 }))

  return (
    <>
      <Link href="/transfers" className="back-link">
        Back to transfers
      </Link>
      <PageHeader
        eyebrow="Transfer"
        title={transfer.reference}
        description={`${transfer.from.name} → ${transfer.to.name}`}
      />

      <div className="detail-meta">
        <TransferStatusPill status={transfer.status} />
        {transfer.note && <span className="muted">{transfer.note}</span>}
      </div>

      <Panel title="Lines">
        <TransferLinesTable lines={transfer.lines} />
      </Panel>

      {shortage && (
        <Panel title="Not enough stock">
          <ul className="shortage-list">
            {shortage.map((row) => (
              <li key={row.skuId}>
                {row.skuCode}: asked for {formatNumber(row.requested)}, only {formatNumber(row.available)} available
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="form-actions">
        {transfer.status === 'draft' && canDispatchTransfers() && (
          <>
            <button
              type="button"
              className="btn btn-primary"
              disabled={dispatch.isPending}
              onClick={() =>
                dispatch.mutate({ id: transfer.id, idempotencyKey: idempotency.current() }, { onSuccess: idempotency.reset })
              }
            >
              Send transfer
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate(transfer.id)}
            >
              Cancel draft
            </button>
          </>
        )}
        {(transfer.status === 'dispatched' || transfer.status === 'partially_received') &&
          canReceiveTransfers() &&
          receiveLines.length > 0 && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={receive.isPending}
              onClick={() =>
                receive.mutate(
                  { id: transfer.id, idempotencyKey: idempotency.current(), lines: receiveLines },
                  { onSuccess: idempotency.reset },
                )
              }
            >
              Receive everything still on the road (good condition)
            </button>
          )}
        {transfer.totals.onTheRoad > 0 && canDispatchTransfers() && (
          <div className="inline-form">
            <input
              type="text"
              className="input"
              placeholder="Reason pieces were lost (3–200 characters)"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              aria-label="Loss reason"
            />
            <button
              type="button"
              className="btn btn-secondary"
              disabled={resolve.isPending || reason.trim().length < 3}
              onClick={() =>
                resolve.mutate(
                  { id: transfer.id, reason: reason.trim(), idempotencyKey: idempotency.current() },
                  { onSuccess: idempotency.reset },
                )
              }
            >
              Confirm lost
            </button>
          </div>
        )}
      </div>
    </>
  )
}
