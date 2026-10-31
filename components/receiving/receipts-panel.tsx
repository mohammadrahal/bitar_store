'use client'

import { useState } from 'react'
import { PackageCheck } from 'lucide-react'
import { ReceiptForm } from '@/components/receiving/receipt-form'
import { MotionTbody, MotionTr } from '@/components/motion/motion-table'
import { MotionSwap } from '@/components/motion/motion-swap'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { usePermission } from '@/hooks/use-permission'
import { useCancelReceipt, useConfirmReceipt, useReceipts } from '@/hooks/use-receiving'
import { formatDocumentDate, formatPrice } from '@/lib/format'
import type { ReceiptRow, ReceiptStatus } from '@/types'

const STATUS_LABELS: Record<ReceiptStatus, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
  corrected: 'Corrected',
}

const STATUS_TONES: Record<ReceiptStatus, string> = {
  draft: 'pill-transit',
  confirmed: 'pill-healthy',
  cancelled: 'pill-neutral',
  corrected: 'pill-neutral',
}

/** Supplier receipts and what can still be done to each one (BL-06). */
export function ReceiptsPanel() {
  const { can, canViewCosts } = usePermission()
  const { data: rows, isPending, isError, error, refetch } = useReceipts('all')
  const confirm = useConfirmReceipt()
  const cancel = useCancelReceipt()
  const [editing, setEditing] = useState<ReceiptRow | null>(null)
  const [correcting, setCorrecting] = useState<ReceiptRow | null>(null)
  const [confirming, setConfirming] = useState<ReceiptRow | null>(null)
  const mayConfirm = can('receipts.confirm')
  const mayEnter = can('receipts.enter')

  return (
    <>
      <Panel title="Receipts" description={isPending ? 'Loading…' : `${rows?.length ?? 0} in total, newest first`}>
        <MotionSwap state={isPending ? 'loading' : isError ? 'error' : 'ready'}>
          {isPending ? (
            <div className="panel-body">
              <Skeleton rows={3} stats={0} />
            </div>
          ) : isError ? (
            <div className="panel-body">
              <ErrorState title="Could not load receipts" error={error} onRetry={() => void refetch()} />
            </div>
          ) : rows.length === 0 ? (
            <div className="panel-body">
              <EmptyState
                icon={PackageCheck}
                title="No receipts yet"
                description="Record what a supplier delivered to the warehouse. A draft changes nothing until it is confirmed."
              />
            </div>
          ) : (
            <div className="table-wrap">
              <table className="card-table">
                <caption className="sr-only">Supplier receipts</caption>
                <thead>
                  <tr>
                    <th scope="col">Receipt</th>
                    <th scope="col">Supplier</th>
                    <th scope="col" className="num">
                      Units
                    </th>
                    {canViewCosts && (
                      <th scope="col" className="num">
                        Total cost
                      </th>
                    )}
                    <th scope="col">Status</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <MotionTbody>
                  {rows.map((row, index) => (
                    <MotionTr key={row.id} index={index}>
                      <td className="card-title" data-label="Receipt">
                        {row.number}
                        <small>
                          {formatDocumentDate(row.receivedOn)}
                          {row.invoiceReference ? ` · ${row.invoiceReference}` : ''}
                          {row.correctsId ? ' · correction' : ''}
                        </small>
                      </td>
                      <td data-label="Supplier">{row.supplierName}</td>
                      <td className="num tabular" data-label="Units">
                        {row.units}
                      </td>
                      {canViewCosts && (
                        <td className="num tabular" data-label="Total cost">
                          {formatPrice(row.total)}
                        </td>
                      )}
                      <td data-label="Status">
                        <span className={`pill ${STATUS_TONES[row.status]}`}>
                          <span className="pill-dot" aria-hidden="true" />
                          {STATUS_LABELS[row.status]}
                        </span>
                        {row.correctionReason && <small className="muted"> {row.correctionReason}</small>}
                      </td>
                      <td data-label="Actions">
                        <div className="row-actions">
                          {row.status === 'draft' && mayEnter && (
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(row)}>
                              Edit
                            </button>
                          )}
                          {row.status === 'draft' && mayConfirm && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              disabled={confirm.isPending}
                              onClick={() => setConfirming(row)}
                            >
                              Confirm
                            </button>
                          )}
                          {row.status === 'draft' && mayEnter && (
                            <button
                              type="button"
                              className="text-btn"
                              disabled={cancel.isPending}
                              onClick={() => cancel.mutate(row.id)}
                            >
                              Cancel
                            </button>
                          )}
                          {row.status === 'confirmed' && mayConfirm && (
                            <button type="button" className="text-btn" onClick={() => setCorrecting(row)}>
                              Correct
                            </button>
                          )}
                        </div>
                      </td>
                    </MotionTr>
                  ))}
                </MotionTbody>
              </table>
            </div>
          )}
        </MotionSwap>
      </Panel>

      {editing && <ReceiptForm receipt={editing} onClose={() => setEditing(null)} />}
      {correcting && <ReceiptForm receipt={correcting} mode="correction" onClose={() => setCorrecting(null)} />}

      {confirming && (
        <ConfirmDialog
          title={`Confirm ${confirming.number}?`}
          description="Confirming records the receipt and its costs, and cannot be undone or repeated — a mistake is fixed with a correction. It does not yet change server stock: the backend has no goods-receipt endpoint, so put the first units in with an opening count."
          confirmLabel="Confirm receipt"
          onResolve={(confirmed) => {
            const target = confirming
            setConfirming(null)
            if (confirmed) confirm.mutate(target.id)
          }}
        />
      )}
    </>
  )
}
