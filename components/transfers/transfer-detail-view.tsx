'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { TransferStatusPill } from '@/components/transfers/transfer-status-pill'
import { TransferStatusStepper } from '@/components/transfers/transfer-status-stepper'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useIdempotencyKey } from '@/hooks/use-idempotency-key'
import { usePermission } from '@/hooks/use-permission'
import {
  useAcceptTransfer,
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
import { inventoryHref, inventoryVariantHref } from '@/lib/inventory-filters'
import type { ApiTransferLine } from '@/lib/api/types'
import { releasableGoodQuantity } from '@/lib/transfer-quantities'
import { TransferDocumentsPanel } from '@/components/transfers/transfer-documents-panel'
import { TransferDispatchPanel } from '@/components/transfers/transfer-dispatch-panel'
import { TransferReceivePanel } from '@/components/transfers/transfer-receive-panel'
import { useTransferSupplyInvoice } from '@/hooks/use-transfer-invoice'
import { receivingNotesOf } from '@/services/transfers.service'

function OnHoldCell({ skuId, skuCode, count }: { skuId: string; skuCode: string; count: number }) {
  const value = formatNumber(count)
  if (count <= 0) return <>{value}</>
  return (
    <Link
      href={inventoryVariantHref(skuId, 'on_hold')}
      className="text-link tabular"
      title={`View ${skuCode} on hold in inventory`}
    >
      {value}
    </Link>
  )
}

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
                On hold
              </th>
              <th scope="col" className="num">
                Sellable
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
                <td className="num">
                  <OnHoldCell skuId={line.sku.id} skuCode={line.sku.code} count={line.onHold ?? 0} />
                </td>
                <td className="num">{line.releasedToSellable ?? 0}</td>
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
  const { canDispatchTransfers, canReceiveTransfers, canAccessLocation } = usePermission()
  const dispatch = useDispatchTransfer()
  const receive = useReceiveTransfer()
  const accept = useAcceptTransfer()
  const resolve = useResolveTransfer()
  const cancel = useCancelTransfer()
  const idempotency = useIdempotencyKey()
  const [reason, setReason] = useState('')

  const supplyInvoiceQuery = useTransferSupplyInvoice(
    data?.id ?? transferId,
    Boolean(data && data.status !== 'draft' && data.status !== 'cancelled'),
    data?.supplyInvoice,
  )
  const supplyInvoice = supplyInvoiceQuery.data

  if (isPending) return <Skeleton rows={6} stats={0} />
  if (isError || !data)
    return <ErrorState title="Transfer unavailable" error={error} onRetry={() => void refetch()} />

  const transfer = data
  const shortage = stockShortagesOf(dispatch.error ?? receive.error)

  /* Lines with pieces still on the way. The counts themselves are typed in
     `TransferReceivePanel`: receiving everything as good with `damaged: 0`
     hardcoded made rules 15 and 16 impossible to satisfy. */
  const onRoadLines = transfer.lines.filter((line) => line.onTheRoad > 0)
  /* Lines with pieces still waiting at the sender, for partial dispatch. */
  const toSendLines = transfer.lines.filter((line) => line.requested - line.dispatched > 0)

  const acceptLines = transfer.lines
    .map((line) => ({ skuId: line.sku.id, quantity: releasableGoodQuantity(line) }))
    .filter((line) => line.quantity > 0)

  const atDestination = canAccessLocation(transfer.to.id)
  const atSource = canAccessLocation(transfer.from.id)

  const canReceiveOnRoad =
    (transfer.status === 'dispatched' || transfer.status === 'partially_received') &&
    canReceiveTransfers() &&
    atDestination &&
    onRoadLines.length > 0

  const canDispatchDraft =
    transfer.status === 'draft' && canDispatchTransfers() && atSource && toSendLines.length > 0

  const invoiceFinal = Boolean(supplyInvoice && supplyInvoice.status === 'final' && !supplyInvoice.voided)
  const receivingNotes = receivingNotesOf(transfer)
  const canCreateSupplyInvoice =
    canDispatchTransfers() && atSource && transfer.status !== 'draft' && transfer.status !== 'cancelled'

  /* Releasing for sale waits on neither the invoice nor a note: in BL-03 the
     supply invoice is finalized after the movement is reconciled, so requiring
     it here held good stock off the shelf for paperwork that comes later. */
  const canAcceptForSale =
    (transfer.status === 'partially_received' || transfer.status === 'received' || transfer.status === 'closed') &&
    canReceiveTransfers() &&
    atDestination &&
    acceptLines.length > 0

  const showReceivingWorkflow = atDestination && transfer.status !== 'draft' && transfer.status !== 'cancelled'

  return (
    <>
      <Link href="/inventory?section=transfers" className="back-link">
        Back to transfers
      </Link>
      <PageHeader
        eyebrow="Transfer"
        title={transfer.reference}
        description={`${transfer.from.name} → ${transfer.to.name}`}
      />

      <div className="detail-meta">
        {transfer.status === 'cancelled' ? (
          <TransferStatusPill status={transfer.status} />
        ) : (
          <TransferStatusStepper status={transfer.status} className="transfer-status-stepper" />
        )}
        {atDestination && transfer.totals.onTheRoad > 0 && (
          <span className="muted">
            Inbound to {transfer.to.name}: {formatNumber(transfer.totals.onTheRoad)} still on the road. receive, then report
            and invoice, then confirm for sale.
          </span>
        )}
        {transfer.totals.onHold > 0 && (
          <Link href={inventoryHref('on_hold')} className="text-link">
            {formatNumber(transfer.totals.onHold)} on hold at {transfer.to.name} (not sellable until confirmed)
          </Link>
        )}
        {transfer.note && <span className="muted">{transfer.note}</span>}
      </div>

      <Panel title="Lines">
        <TransferLinesTable lines={transfer.lines} />
      </Panel>

      {canDispatchDraft && (
        <TransferDispatchPanel
          key={`${transfer.id}-${transfer.totals.dispatched}`}
          lines={toSendLines}
          pending={dispatch.isPending}
          onDispatch={(lines) =>
            dispatch.mutate(
              { id: transfer.id, idempotencyKey: idempotency.current(), lines },
              { onSuccess: idempotency.reset },
            )
          }
        />
      )}

      {canReceiveOnRoad && (
        <TransferReceivePanel
          key={`${transfer.id}-${transfer.totals.onTheRoad}`}
          lines={onRoadLines}
          pending={receive.isPending}
          onReceive={(lines, note) =>
            receive.mutate(
              { id: transfer.id, idempotencyKey: idempotency.current(), lines, note },
              { onSuccess: idempotency.reset },
            )
          }
        />
      )}

      <TransferDocumentsPanel
        transfer={transfer}
        canCreateSupplyInvoice={canCreateSupplyInvoice}
        reportNoteRecorded={receivingNotes.length > 0}
        receivingSite={showReceivingWorkflow}
        sendingSite={atSource && !atDestination}
      />

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
        {/* Cancel is offered on a draft only: rule 14 blocks cancelling a
            transfer once it has been dispatched. */}
        {transfer.status === 'draft' && canDispatchTransfers() && atSource && (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate(transfer.id)}
          >
            Cancel draft
          </button>
        )}
        {showReceivingWorkflow &&
          transfer.totals.onHold > 0 &&
          canReceiveTransfers() &&
          (transfer.status === 'partially_received' ||
            transfer.status === 'received' ||
            transfer.status === 'closed') && (
          <div className="stack gap-sm">
            <div className="inline-form">
              <Link href={`/transfers/${transfer.id}/report`} className="btn btn-secondary">
                View report
              </Link>
              {supplyInvoice ? (
                <Link href={`/sales/invoices/${supplyInvoice.id}`} className="btn btn-secondary">
                  View invoice
                </Link>
              ) : null}
              <button
                type="button"
                className="btn btn-primary"
                disabled={accept.isPending || !canAcceptForSale}
                onClick={() =>
                  accept.mutate(
                    { id: transfer.id, idempotencyKey: idempotency.current(), lines: acceptLines },
                    { onSuccess: idempotency.reset },
                  )
                }
              >
                Confirm for sale ({formatNumber(acceptLines.reduce((sum, row) => sum + row.quantity, 0))} good)
              </button>
            </div>
            {receivingNotes.length > 0 && (
              <p className="muted text-sm" style={{ margin: 0 }}>
                Last note on receiving: “{receivingNotes[receivingNotes.length - 1].note}” —{' '}
                {receivingNotes[receivingNotes.length - 1].by.name ?? 'Unknown'}
              </p>
            )}
            {supplyInvoice && !invoiceFinal && (
              <p className="muted text-sm" style={{ margin: 0 }}>
                The{' '}
                <Link href={`/sales/invoices/${supplyInvoice.id}`} className="text-link">
                  supply invoice
                </Link>{' '}
                is still a draft. The warehouse finalizes it once this movement is reconciled; it does not hold up the
                release.
              </p>
            )}
          </div>
        )}
        {transfer.totals.onTheRoad > 0 && canDispatchTransfers() && atSource && (
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
