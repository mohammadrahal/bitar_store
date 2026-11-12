'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowLeft, ArrowLeftRight } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { LocationEyebrow, PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { LegacyReceiptDetail } from '@/components/stock-receipts/legacy-receipt-detail'
import { ReceiptPhoto } from '@/components/stock-receipts/receipt-photo'
import { useGoodsReceipt } from '@/hooks/use-goods-receipts'
import { usePermission } from '@/hooks/use-permission'
import { useStockReceipts } from '@/hooks/use-stock-receipts'
import { ApiError } from '@/lib/api/api-error'
import { formatDateInput, formatNumber, formatPrice, formatRelativeDateTime } from '@/lib/format'
import { priceOf } from '@/lib/api/map-catalog'
import type { ApiGoodsReceipt } from '@/lib/api/types'
/**
 * One delivery.
 *
 * The id can name either a `GET /goods-receipts/:id` document or a receipt the
 * old build left in this browser, and both are reachable from the same list, so
 * this asks the server first and falls back to the device. Only a `404` is a
 * reason to look locally. a `403` or a dead connection means the server's
 * answer is unknown, and quietly showing a local record instead would present
 * paperwork as if it were the shared document.
 */
export function ReceiptDetailView({ receiptId }: { receiptId: string }) {
  const server = useGoodsReceipt(receiptId)
  const local = useStockReceipts()

  const notOnServer = server.isError && server.error instanceof ApiError && server.error.status === 404
  const hasLocal = (local.data ?? []).some((row) => row.id === receiptId)

  if (server.isPending || (notOnServer && local.isPending)) return <Skeleton rows={4} />

  if (notOnServer && hasLocal) return <LegacyReceiptDetail receiptId={receiptId} />

  if (notOnServer) {
    return (
      <>
        <Link href={'/stock-receipts'} className="back-link">
          <ArrowLeft size={16} aria-hidden="true" />
          Receive stock
        </Link>
        <EmptyState
          icon={AlertTriangle}
          title="No such receipt"
          description="It is not on the server, and this browser has no copy of it either."
          action={
            <Link href={'/stock-receipts'} className="btn btn-secondary">
              Back to receipts
            </Link>
          }
        />
      </>
    )
  }

  if (server.isError || !server.data) {
    return (
      <>
        <Link href={'/stock-receipts'} className="back-link">
          <ArrowLeft size={16} aria-hidden="true" />
          Receive stock
        </Link>
        <ErrorState
          title="Could not load this receipt"
          error={server.error}
          onRetry={() => void server.refetch()}
        />
      </>
    )
  }

  return <GoodsReceiptDetail receipt={server.data} />
}

function GoodsReceiptDetail({ receipt }: { receipt: ApiGoodsReceipt }) {
  const { canDispatchTransfers } = usePermission()
  const showCosts = receipt.lines.some((line) => priceOf(line.unitCost) > 0)

  return (
    <>
      <Link href={'/stock-receipts'} className="back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        Receive stock
      </Link>

      <PageHeader
        eyebrow={<LocationEyebrow label="Received at" name={receipt.warehouse.name} />}
        title={receipt.reference}
        description={`Recorded by ${receipt.receivedBy.name ?? 'someone'} ${formatRelativeDateTime(receipt.createdAt)}`}
        actions={
          /* The next step in the chain: stock lands at the warehouse and
             reaches a shop by transfer, so the receipt that just put it there
             is where that journey starts, with From already filled in. */
          canDispatchTransfers() && receipt.totalQuantity > 0 ? (
            <Link
              href={`/transfers/new?from=${encodeURIComponent(receipt.warehouse.id)}`}
              className="btn btn-primary"
            >
              <ArrowLeftRight size={16} aria-hidden="true" />
              Send to a branch
            </Link>
          ) : undefined
        }
      />

      <div className="stack">
        <Panel
          title="The invoice"
          description="The photograph is kept in the browser that recorded this delivery. Everything else below is on the server."
        >
          <div className="panel-body">
            <ReceiptPhoto receiptId={receipt.id} />
          </div>
        </Panel>

        <Panel title="The document" description="Recorded on the server. It cannot be edited or deleted.">
          <div className="panel-body">
          <dl className="detail-grid-fields detail-grid-fields--receipt">
            <div>
              <dt>Supplier</dt>
              <dd>
                {receipt.supplierName}
                {receipt.supplier?.phone ? <small className="muted"> · {receipt.supplier.phone}</small> : null}
                {receipt.supplier?.id ? (
                  <small className="muted">
                    {' · '}
                    <Link href={`/suppliers`} className="link-subtle">
                      Supplier record
                    </Link>
                  </small>
                ) : null}
              </dd>
            </div>
            <div>
              <dt>Receipt number</dt>
              <dd className="tabular">{receipt.reference}</dd>
            </div>
            <div>
              <dt>Their invoice number</dt>
              {/* Optional since 9 Nov: say so rather than print an empty cell
                  that reads as data gone missing. */}
              <dd className={receipt.supplierInvoiceNumber ? 'tabular' : 'muted'}>
                {receipt.supplierInvoiceNumber ?? 'None given'}
              </dd>
            </div>
            <div>
              <dt>Date on the invoice</dt>
              <dd className="tabular">{formatDateInput(receipt.invoiceDate)}</dd>
            </div>
            <div>
              <dt>Received into</dt>
              <dd>{receipt.warehouse.name}</dd>
            </div>
            <div>
              <dt>Pieces received</dt>
              <dd className="tabular">{formatNumber(receipt.totalQuantity)}</dd>
            </div>
            <div>
              <dt>Total cost</dt>
              <dd className="tabular">{formatPrice(priceOf(receipt.totalCost))}</dd>
            </div>
          </dl>
          {receipt.note && <p className="section-note">{receipt.note}</p>}
          <p className="section-note">
            A mistake on a posted receipt is corrected with a stock adjustment, which keeps both the original and the
            correction in the record.
          </p>
          </div>
        </Panel>

        <Panel title="Lines" description="What arrived, and what the supplier charged for each piece.">
          <div className="table-wrap table-wrap-scroll">
            <table className="card-table receipt-lines-table">
              <caption className="sr-only">Lines on this receipt</caption>
              <thead>
                <tr>
                  <th scope="col">Description</th>
                  <th scope="col">SKU</th>
                  <th scope="col" className="num">
                    Pieces
                  </th>
                  {showCosts && (
                    <th scope="col" className="num">
                      Unit cost
                    </th>
                  )}
                  {showCosts && (
                    <th scope="col" className="num">
                      Line total
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {receipt.lines.map((line) => (
                  <tr key={line.sku.id}>
                    <td className="card-title">
                      {line.sku.styleName}
                      <small>
                        {line.sku.color} / {line.sku.size}
                      </small>
                    </td>
                    <td className="tabular" data-label="SKU">
                      {line.sku.code}
                    </td>
                    <td className="num tabular" data-label="Pieces">
                      {formatNumber(line.quantity)}
                    </td>
                    {showCosts && (
                      <td className="num tabular" data-label="Unit cost">
                        {formatPrice(priceOf(line.unitCost))}
                      </td>
                    )}
                    {showCosts && (
                      <td className="num tabular" data-label="Line total">
                        {formatPrice(priceOf(line.lineTotal))}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  )
}
