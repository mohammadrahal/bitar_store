'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { Printer } from 'lucide-react'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { TransferReceivePanel } from '@/components/transfers/transfer-receive-panel'
import { TransferStatusPill } from '@/components/transfers/transfer-status-pill'
import { TransferStatusStepper } from '@/components/transfers/transfer-status-stepper'
import { useIdempotencyKey } from '@/hooks/use-idempotency-key'
import { useTransferAuditEvents } from '@/hooks/use-reports-api'
import { useTransferSupplyInvoice } from '@/hooks/use-transfer-invoice'
import { useAcceptTransfer, useReceiveTransfer } from '@/hooks/use-transfers'
import { useTransfer } from '@/hooks/use-transfers'
import { usePermission } from '@/hooks/use-permission'
import { invoiceLabel } from '@/services/invoices-api.service'
import { receivingNotesOf } from '@/services/transfers.service'
import { formatAuditAction, formatDocumentDate, formatNumber, formatRelativeDateTime } from '@/lib/format'
import { releasableGoodQuantity } from '@/lib/transfer-quantities'

function CheckItem({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className={ok ? '' : 'detail-alert'}>
      {ok ? '✓' : '○'} {children}
    </li>
  )
}

export function TransferReceivingReportView({ transferId }: { transferId: string }) {
  const { data, isPending, isError, error, refetch } = useTransfer(transferId)
  const { canViewAdminWarehouseTools, canReceiveTransfers, canAccessLocation } = usePermission()
  const audit = useTransferAuditEvents(transferId, canViewAdminWarehouseTools())
  const receive = useReceiveTransfer()
  const accept = useAcceptTransfer()
  const idempotency = useIdempotencyKey()

  const supplyInvoiceQuery = useTransferSupplyInvoice(
    transferId,
    Boolean(data && data.status !== 'draft' && data.status !== 'cancelled'),
    data?.supplyInvoice,
  )
  const supplyInvoice = supplyInvoiceQuery.data

  if (isPending) return <Skeleton rows={8} stats={0} />
  if (isError || !data)
    return <ErrorState title="Report unavailable" error={error} onRetry={() => void refetch()} />

  const transfer = data
  const atDestination = canAccessLocation(transfer.to.id)
  const onRoadLines = transfer.lines.filter((line) => line.onTheRoad > 0)
  const acceptLines = transfer.lines
    .map((line) => ({ skuId: line.sku.id, quantity: releasableGoodQuantity(line) }))
    .filter((line) => line.quantity > 0)
  const pendingSellable = acceptLines.reduce((sum, row) => sum + row.quantity, 0)

  const canReceiveOnRoad =
    (transfer.status === 'dispatched' || transfer.status === 'partially_received') &&
    canReceiveTransfers() &&
    atDestination &&
    onRoadLines.length > 0

  const invoiceFinal = Boolean(supplyInvoice && supplyInvoice.status === 'final' && !supplyInvoice.voided)
  const receivingNotes = receivingNotesOf(transfer)
  /*
   * The invoice is **not** a condition of releasing stock for sale.
   *
   * This used to require a finalized supply invoice and three characters of
   * local note before the button would work, which stranded shipments at the
   * branch: in BL-03 the invoice is a draft from the moment the warehouse
   * dispatches and is finalized only after the movement is reconciled, so
   * waiting for it is waiting for something that comes later. The invoice state
   * is still shown below, as information rather than as a gate.
   */
  const canAcceptForSale =
    (transfer.status === 'partially_received' ||
      transfer.status === 'received' ||
      transfer.status === 'closed') &&
    canReceiveTransfers() &&
    atDestination &&
    acceptLines.length > 0

  return (
    <div className="print-root stack">
      <Link href={`/transfers/${transferId}`} className="back-link no-print">
        Back to transfer
      </Link>
      <PageHeader
        eyebrow="Receiving report"
        title={transfer.reference}
        description={`${transfer.from.name} → ${transfer.to.name} · Destination inspection record`}
        actions={
          <button type="button" className="btn btn-secondary no-print" onClick={() => window.print()}>
            <Printer size={16} aria-hidden="true" />
            Print report
          </button>
        }
      />

      <div className="detail-meta">
        {transfer.status === 'cancelled' ? (
          <TransferStatusPill status={transfer.status} />
        ) : (
          <TransferStatusStepper status={transfer.status} className="transfer-status-stepper" />
        )}
        <span className="muted">Prepared {formatRelativeDateTime(transfer.requestedAt)}</span>
        {transfer.dispatchedAt && (
          <span className="muted">Sent {formatRelativeDateTime(transfer.dispatchedAt)}</span>
        )}
      </div>

      {!atDestination && (
        <p className="section-note muted no-print">
          You are not at the destination branch. Switch location or open this transfer from {transfer.to.name} to record
          arrivals and confirm for sale.
        </p>
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

      <Panel title="Shipment summary">
        <div className="panel-body stack gap-sm">
          <dl className="detail-grid-fields">
            <div>
              <dt>From</dt>
              <dd>{transfer.from.name}</dd>
            </div>
            <div>
              <dt>To</dt>
              <dd>{transfer.to.name}</dd>
            </div>
            <div>
              <dt>Prepared by</dt>
              <dd>{transfer.requestedBy.name ?? ''}</dd>
            </div>
            <div>
              <dt>Sent by</dt>
              <dd>{transfer.dispatchedBy?.name ?? ''}</dd>
            </div>
            {transfer.note && (
              <div>
                <dt>Transfer note</dt>
                <dd>{transfer.note}</dd>
              </div>
            )}
          </dl>
          <p className="section-note muted no-print" style={{ margin: 0 }}>
            Totals below update after you save arrival counts above (good and damaged). You cannot edit past totals
            directly. <strong>Lost</strong> is confirmed on the transfer page at the sender when pieces never arrive.
            <strong> Sellable</strong> updates when you confirm for sale below.
          </p>
        </div>
      </Panel>

      <Panel
        title="Quantities received"
        description="Recorded on the server. Good and damaged for new pieces are entered in the arrival form above."
      >
        <div className="table-wrap">
          <table className="card-table card-table--transfer-receiving">
            <caption className="sr-only">Quantities received by SKU</caption>
            <thead>
              <tr>
                <th scope="col">SKU</th>
                <th scope="col" className="num">
                  Sent
                </th>
                <th scope="col" className="num">
                  On the road
                </th>
                <th scope="col" className="num">
                  Received
                </th>
                <th scope="col" className="num">
                  Damaged
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
              </tr>
            </thead>
            <tbody>
              {transfer.lines.map((line) => {
                const pending = releasableGoodQuantity(line)
                return (
                  <tr key={line.sku.id}>
                    <td className="card-title">
                      {line.sku.code}
                      <small>
                        {[line.sku.styleName, line.sku.color, line.sku.size].filter(Boolean).join(' · ')}
                      </small>
                    </td>
                    <td className="num tabular">{formatNumber(line.dispatched)}</td>
                    <td className="num tabular">{formatNumber(line.onTheRoad)}</td>
                    <td className="num tabular">{formatNumber(line.received)}</td>
                    <td className="num tabular">{formatNumber(line.damaged)}</td>
                    <td className="num tabular">{formatNumber(line.onHold)}</td>
                    <td className="num tabular">
                      {formatNumber(line.releasedToSellable)}
                      {pending > 0 ? (
                        <small className="invoice-muted"> +{formatNumber(pending)} pending</small>
                      ) : null}
                    </td>
                    <td className="num tabular">{formatNumber(line.lost)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="card-title">Totals</td>
                <td className="num tabular">{formatNumber(transfer.totals.dispatched)}</td>
                <td className="num tabular">{formatNumber(transfer.totals.onTheRoad)}</td>
                <td className="num tabular">{formatNumber(transfer.totals.received)}</td>
                <td className="num tabular">{formatNumber(transfer.totals.damaged)}</td>
                <td className="num tabular">{formatNumber(transfer.totals.onHold)}</td>
                <td className="num tabular">
                  {formatNumber(transfer.totals.releasedToSellable)}
                  {pendingSellable > 0 ? (
                    <small className="invoice-muted"> +{formatNumber(pendingSellable)} pending</small>
                  ) : null}
                </td>
                <td className="num tabular">{formatNumber(transfer.totals.lost)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>

      <Panel
        title="Inspector notes"
        description="What was recorded with each count, as it was sent to the warehouse."
      >
        <div className="panel-body stack gap-sm">
          {receivingNotes.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              {onRoadLines.length > 0
                ? 'No note yet. Write one with the count above: it travels with the receipt.'
                : 'No note was recorded on this shipment.'}
            </p>
          ) : (
            <ol className="stack gap-sm" style={{ margin: 0, paddingLeft: '1.25rem' }}>
              {receivingNotes.map((receipt) => (
                <li key={receipt.id}>
                  <p style={{ margin: 0 }}>{receipt.note}</p>
                  <small className="muted">
                    {receipt.by.name ?? 'Unknown'} · {formatRelativeDateTime(receipt.at)}
                  </small>
                </li>
              ))}
            </ol>
          )}
        </div>
      </Panel>

      {atDestination &&
        transfer.status !== 'draft' &&
        transfer.status !== 'cancelled' &&
        (pendingSellable > 0 || transfer.totals.onHold > 0) && (
          <Panel title="Confirm for sale" className="no-print">
            <div className="panel-body stack gap-sm">
              <p className="muted text-sm" style={{ margin: 0 }}>
                Releases good stock from on hold to the sellable shelf. Damaged units are never released.
              </p>
              <ul className="muted text-sm" style={{ margin: 0, paddingLeft: '1.25rem' }}>
                <CheckItem ok={acceptLines.length > 0}>
                  Good stock on hold to release ({formatNumber(pendingSellable)} pieces)
                </CheckItem>
              </ul>
              <p className="muted text-sm" style={{ margin: 0 }}>
                {supplyInvoice ? (
                  <>
                    Supply invoice{' '}
                    <Link href={`/transfers/${transfer.id}/invoice`} className="text-link">
                      {invoiceLabel(supplyInvoice)}
                    </Link>{' '}
                    {invoiceFinal
                      ? 'is finalized.'
                      : 'is still a draft. The warehouse finalizes it after this movement is reconciled, so it does not hold up the release.'}
                  </>
                ) : (
                  <>The warehouse has not raised a supply invoice yet. It does not hold up the release.</>
                )}
              </p>
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={accept.isPending || !canAcceptForSale}
                  title={acceptLines.length === 0 ? 'No good stock waiting to release' : undefined}
                  onClick={() =>
                    accept.mutate(
                      { id: transfer.id, idempotencyKey: idempotency.current(), lines: acceptLines },
                      { onSuccess: idempotency.reset },
                    )
                  }
                >
                  {accept.isPending
                    ? 'Confirming…'
                    : `Confirm for sale (${formatNumber(pendingSellable)} good)`}
                </button>
                {supplyInvoice ? (
                  <Link href={`/transfers/${transfer.id}/invoice`} className="btn btn-secondary">
                    View supply invoice
                  </Link>
                ) : null}
              </div>
            </div>
          </Panel>
        )}

      {audit.data && audit.data.length > 0 && (
        <Panel title="Audit trail">
          <div className="table-wrap">
            <table className="card-table">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Action</th>
                  <th scope="col">By</th>
                </tr>
              </thead>
              <tbody>
                {audit.data.map((event) => (
                  <tr key={event.id}>
                    <td>{formatDocumentDate(event.occurredAt)}</td>
                    <td>{formatAuditAction(event.action)}</td>
                    <td>{event.by.name ?? event.by.id.slice(0, 8)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  )
}
