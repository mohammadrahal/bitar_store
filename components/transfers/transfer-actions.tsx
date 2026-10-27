'use client'

import { useState } from 'react'
import { LineQuantitiesDialog } from '@/components/transfers/line-quantities-dialog'
import { ReasonDialog } from '@/components/shared/reason-dialog'
import { useIdempotencyKey } from '@/hooks/use-idempotency-key'
import { usePermission } from '@/hooks/use-permission'
import {
  useApproveTransfer,
  useCancelTransfer,
  useDispatchTransfer,
  useReleaseReserved,
  useReportDiscrepancy,
} from '@/hooks/use-transfers'
import { canCancelTransfer, lineStillReserved } from '@/lib/transfers'
import type { TransferRow } from '@/types'

type Dialog = 'approve' | 'dispatch' | 'cancel' | 'discrepancy'

/** Only the steps the current user may take at this point, for the side of the transfer they belong to. */
export function TransferActions({ transfer, onReceive }: { transfer: TransferRow; onReceive: () => void }) {
  const { can, canAccessBranch } = usePermission()
  const idempotency = useIdempotencyKey()
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const approve = useApproveTransfer()
  const dispatch = useDispatchTransfer()
  const release = useReleaseReserved()
  const discrepancy = useReportDiscrepancy()
  const cancel = useCancelTransfer()

  const atSender = canAccessBranch(transfer.fromBranchId)
  const atReceiver = canAccessBranch(transfer.toBranchId)
  const { totals, status } = transfer
  const done = { onSuccess: () => { idempotency.reset(); setDialog(null) } }

  const show = {
    approve: status === 'requested' && atSender && can('transfers:approve'),
    dispatch: totals.stillReserved > 0 && status !== 'requested' && atSender && can('transfers:dispatch'),
    release: totals.stillReserved > 0 && status !== 'requested' && atSender && can('transfers:approve'),
    receive: totals.inTransit > 0 && atReceiver && can('transfers:receive'),
    discrepancy: totals.inTransit > 0 && atReceiver && can('transfers:receive'),
    cancel: canCancelTransfer(transfer) && atSender && can('transfers:approve'),
  }
  if (!Object.values(show).some(Boolean)) return null

  return (
    <div className="action-bar">
      {show.approve && <button type="button" className="btn btn-primary" onClick={() => setDialog('approve')}>Approve</button>}
      {show.dispatch && <button type="button" className="btn btn-primary" onClick={() => setDialog('dispatch')}>Dispatch</button>}
      {show.receive && <button type="button" className="btn btn-primary" onClick={onReceive}>Receive</button>}
      {show.release && (
        <button
          type="button"
          className="btn btn-secondary"
          disabled={release.isPending}
          onClick={() => release.mutate({ id: transfer.id, key: idempotency.current() }, done)}
        >
          Release {totals.stillReserved} reserved
        </button>
      )}
      {show.discrepancy && (
        <button type="button" className="btn btn-secondary" onClick={() => setDialog('discrepancy')}>Report discrepancy</button>
      )}
      {show.cancel && (
        <button type="button" className="btn btn-danger-outline" onClick={() => setDialog('cancel')}>Cancel transfer</button>
      )}

      {dialog === 'approve' && (
        <LineQuantitiesDialog
          title={`Approve ${transfer.number}`}
          description="Approved units are reserved at the sender, so they cannot be sold or sent elsewhere."
          confirmLabel="Approve"
          lines={transfer.lines}
          capOf={(line) => line.requested}
          capLabel="requested"
          pending={approve.isPending}
          onCancel={() => setDialog(null)}
          onConfirm={(quantities) => approve.mutate({ id: transfer.id, quantities, key: idempotency.current() }, done)}
        />
      )}
      {dialog === 'dispatch' && (
        <LineQuantitiesDialog
          title={`Dispatch ${transfer.number}`}
          description="Send part now and the rest stays reserved. Dispatching raises the transfer invoices."
          confirmLabel="Dispatch"
          lines={transfer.lines}
          capOf={lineStillReserved}
          capLabel="approved, not sent"
          pending={dispatch.isPending}
          onCancel={() => setDialog(null)}
          onConfirm={(quantities) => dispatch.mutate({ id: transfer.id, quantities, key: idempotency.current() }, done)}
        />
      )}
      {dialog === 'cancel' && (
        <ReasonDialog
          title={`Cancel ${transfer.number}?`}
          description="Nothing has been dispatched, so any reserved units go back to available at the sender."
          confirmLabel="Cancel transfer"
          pending={cancel.isPending}
          onCancel={() => setDialog(null)}
          onConfirm={(reason) => cancel.mutate({ id: transfer.id, reason, key: idempotency.current() }, done)}
        />
      )}
      {dialog === 'discrepancy' && (
        <ReasonDialog
          title="Report a discrepancy"
          description={`The ${totals.inTransit} units still in transit will be written off as missing and the transfer can close.`}
          confirmLabel="Record as missing"
          reasonLabel="What happened?"
          pending={discrepancy.isPending}
          onCancel={() => setDialog(null)}
          onConfirm={(note) => discrepancy.mutate({ id: transfer.id, note, key: idempotency.current() }, done)}
        />
      )}
    </div>
  )
}
