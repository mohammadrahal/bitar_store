'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowLeft, ArrowLeftRight, Trash2 } from 'lucide-react'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { LocationEyebrow, PageHeader } from '@/components/shared/page-header'
import { ReceiptPhoto } from '@/components/stock-receipts/receipt-photo'
import { Panel } from '@/components/shared/panel'
import { useBranches } from '@/hooks/use-branches'
import { useDeleteStockReceipt, useStockReceipts } from '@/hooks/use-stock-receipts'
import { usePermission } from '@/hooks/use-permission'
import { formatDateInput, formatNumber, formatPrice, formatRelativeDateTime } from '@/lib/format'
import {
  receiptFailures,
  receiptHasCosts,
  receiptNote,
  receiptTotal,
  receiptUnits,
} from '@/services/stock-receipts.service'
import { inventoryHubHref } from '@/lib/inventory-hub'

/**
 * A delivery recorded before `POST /goods-receipts` was wired up.
 *
 * Kept read-only so nobody loses their history. Its quantities went to the
 * server as one `/stock/adjustments` call per line, which is why a line here
 * can say "Refused" while the others landed. the new path cannot do that.
 */
export function LegacyReceiptDetail({ receiptId }: { receiptId: string }) {
  const router = useRouter()
  const { data: receipts, isPending } = useStockReceipts()
  const { data: branches } = useBranches()
  const remove = useDeleteStockReceipt()
  const { canDispatchTransfers } = usePermission()
  const [confirming, setConfirming] = useState(false)

  const receipt = receipts?.find((row) => row.id === receiptId)

  if (isPending) return null

  if (!receipt) {
    return (
      <>
        <Link href={inventoryHubHref('receive-stock')} className="back-link">
          <ArrowLeft size={16} aria-hidden="true" />
          Receive stock
        </Link>
        <EmptyState
          icon={AlertTriangle}
          title="This receipt is not on this device"
          description="Receipt paperwork is saved in the browser that recorded it. The stock it placed is on the server and is unaffected."
          action={
            <Link href={inventoryHubHref('receive-stock')} className="btn btn-secondary">
              Back to receipts
            </Link>
          }
        />
      </>
    )
  }

  const branchName = branches?.find((branch) => branch.id === receipt.branchId)?.name ?? 'Unknown location'
  const failed = receiptFailures(receipt)
  const units = receiptUnits(receipt)
  const showCosts = receiptHasCosts(receipt)
  /* Somewhere to send it, and the right to prepare the transfer. A single-site
     business has neither, so the action simply is not there. */
  const canSend = canDispatchTransfers() && (branches?.filter((branch) => branch.id !== receipt.branchId).length ?? 0) > 0

  return (
    <>
      <Link href={inventoryHubHref('receive-stock')} className="back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        Receive stock
      </Link>

      <PageHeader
        eyebrow={<LocationEyebrow label="Received at" name={branchName} />}
        title={receipt.receiptNo || receipt.reference || receipt.supplierName || 'Untitled receipt'}
        description={`Recorded by ${receipt.postedByName} ${formatRelativeDateTime(receipt.postedAt)}`}
        actions={
          <>
            {/* The next step in the chain. Stock lands at the warehouse and
                reaches a shop by transfer, so the receipt that just put it
                there is where that journey starts. with From already filled
                in. Absent when nothing was actually received, or when there is
                nowhere to send it to. */}
            {units > 0 && canSend && (
              <Link
                href={`/transfers/new?from=${encodeURIComponent(receipt.branchId)}`}
                className="btn btn-primary"
              >
                <ArrowLeftRight size={16} aria-hidden="true" />
                Send to a branch
              </Link>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => setConfirming(true)}>
              <Trash2 size={16} aria-hidden="true" />
              Remove
            </button>
          </>
        }
      />

      <div className="stack">
        {failed.length > 0 && (
          <Panel title="Some lines did not post" description="The rest of the delivery is already on the shelf.">
            <ul className="section-note-list">
              {failed.map((line) => (
                <li key={line.skuId}>
                  <strong>{line.label}</strong> ({line.code}). {line.error ?? 'did not post'}
                </li>
              ))}
            </ul>
            <p className="section-note">
              Lines post one at a time, so a refusal part-way through leaves the lines before it received. Record a
              second receipt for whatever is still missing rather than re-posting this one.
            </p>
          </Panel>
        )}

        <Panel title="The invoice" description="The paperwork this receipt was copied from.">
          <div className="panel-body">
            <ReceiptPhoto receiptId={receipt.id} meta={receipt.photo} />
          </div>
        </Panel>

        <Panel title="The document" description="Saved in this browser only.">
          <div className="panel-body">
          <dl className="detail-grid-fields detail-grid-fields--receipt">
            <div>
              <dt>Supplier</dt>
              <dd>{receipt.supplierName || 'Not recorded'}</dd>
            </div>
            <div>
              <dt>Receipt number</dt>
              <dd className="tabular">{receipt.receiptNo || 'Not recorded'}</dd>
            </div>
            <div>
              <dt>Their document number</dt>
              <dd className="tabular">{receipt.reference || 'Not recorded'}</dd>
            </div>
            <div>
              <dt>Date on the document</dt>
              <dd className="tabular">{formatDateInput(receipt.receivedOn)}</dd>
            </div>
            <div>
              <dt>Arrived at</dt>
              <dd>{branchName}</dd>
            </div>
            <div>
              <dt>Pieces received</dt>
              <dd className="tabular">{formatNumber(units)}</dd>
            </div>
            {showCosts && (
              <div>
                <dt>Value received</dt>
                <dd className="tabular">{formatPrice(receiptTotal(receipt))}</dd>
              </div>
            )}
          </dl>
          {receipt.note && <p className="section-note">{receipt.note}</p>}
          <p className="section-note">
            The server's audit log records these quantities as <q className="tabular">{receiptNote(receipt)}</q>.
          </p>
          </div>
        </Panel>

        <Panel title="Lines" description="A line with no adjustment behind it never reached the server.">
          <div className="table-wrap table-wrap-scroll">
            <table className="card-table receipt-lines-table">
              <caption className="sr-only">Lines on this receipt</caption>
              <thead>
                <tr>
                  <th scope="col">Description</th>
                  <th scope="col">SKU</th>
                  <th scope="col" className="num">Pieces</th>
                  {showCosts && <th scope="col" className="num">Unit cost</th>}
                  {showCosts && <th scope="col" className="num">Line total</th>}
                  <th scope="col">Posted</th>
                </tr>
              </thead>
              <tbody>
                {receipt.lines.map((line) => (
                  <tr key={line.skuId}>
                    <td className="card-title">{line.label}</td>
                    <td className="tabular" data-label="SKU">{line.code}</td>
                    <td className="num tabular" data-label="Pieces">{formatNumber(line.quantity)}</td>
                    {showCosts && (
                      <td className="num tabular" data-label="Unit cost">
                        {line.unitCost > 0 ? formatPrice(line.unitCost) : ''}
                      </td>
                    )}
                    {showCosts && (
                      <td className="num tabular" data-label="Line total">
                        {line.unitCost > 0 ? formatPrice(line.quantity * line.unitCost) : ''}
                      </td>
                    )}
                    <td data-label="Posted">
                      {line.adjustmentId ? (
                        <span className="pill pill-in-stock">On the shelf</span>
                      ) : (
                        <span className="pill pill-out">Refused</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {confirming && (
        <ConfirmDialog
          title="Remove this receipt?"
          description="It deletes this device's copy of the paperwork. The pieces it put on the shelf stay there, and the corrections behind them stay in the server's audit log."
          confirmLabel="Remove receipt"
          tone="danger"
          onResolve={(confirmed) => {
            setConfirming(false)
            if (confirmed)
              remove.mutate(receipt.id, { onSuccess: () => router.push(inventoryHubHref('receive-stock')) })
          }}
        />
      )}
    </>
  )
}
