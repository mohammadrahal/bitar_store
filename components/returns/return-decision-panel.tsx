'use client'

import { useState } from 'react'
import { Field } from '@/components/shared/field'
import { Panel } from '@/components/shared/panel'
import { useIdempotencyKey } from '@/hooks/use-idempotency-key'
import { useApproveReturn, useRejectReturn, useTakeReturnCustody } from '@/hooks/use-returns'
import { awaitsGoods, canApproveReturn, unitsReturned } from '@/services/returns.service'
import type { ApiReturn } from '@/lib/api/types'

/**
 * Step 2 of 4: the manager's decision.
 *
 * Approving and rejecting sit side by side **with the reject reason always
 * visible**, not behind a second click. The reason is required by the server,
 * and a cashier who has to reveal a field before they can refuse a return
 * learns to approve instead.
 *
 * Approving does not pay and does not release. The panel says so on the button
 * row, because this is the single point where that is most likely to be
 * misread.
 */
export function ReturnDecisionPanel({ entry }: { entry: ApiReturn }) {
  const approve = useApproveReturn()
  const reject = useRejectReturn()
  const custody = useTakeReturnCustody()
  const idempotency = useIdempotencyKey()
  const [note, setNote] = useState('')
  const [rejectReason, setRejectReason] = useState('')

  const units = unitsReturned(entry)
  const pending = approve.isPending || reject.isPending || custody.isPending

  if (awaitsGoods(entry)) {
    return (
      <Panel
        title="The goods are not here yet"
        description="This return was recorded while the customer kept the items. It cannot be decided until they arrive."
      >
        <div className="panel-body stack gap-sm">
          <p className="muted text-sm" style={{ margin: 0 }}>
            When the customer brings them in, record it here. Nothing is approved by this step.
          </p>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={pending}
              onClick={() => custody.mutate(entry.id)}
            >
              {custody.isPending ? 'Recording…' : 'The goods have arrived'}
            </button>
          </div>
        </div>
      </Panel>
    )
  }

  if (!canApproveReturn(entry)) return null

  return (
    <Panel
      title="Decide this return"
      description="Approving puts the goods on hold and fixes what is owed. It does not pay the refund and does not put anything back on the shelf."
    >
      <div className="panel-body stack gap-md" style={{ maxWidth: '36rem' }}>
        <Field
          label="Note on the approval (optional)"
          hint="Anything the next person should know. Not shown to the customer."
        >
          <input
            type="text"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={200}
            disabled={pending}
          />
        </Field>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending}
            onClick={() =>
              approve.mutate(
                { id: entry.id, reason: note.trim() || undefined, idempotencyKey: idempotency.current() },
                { onSuccess: idempotency.reset },
              )
            }
          >
            {approve.isPending
              ? 'Approving…'
              : `Approve ${units} ${units === 1 ? 'unit' : 'units'}`}
          </button>
        </div>

        <hr className="panel-divider" />

        <Field
          label="Or reject it, with a reason"
          hint="The customer is told this. 3 to 200 characters. No stock moves and nothing is owed."
        >
          <input
            type="text"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder="Worn and washed"
            maxLength={200}
            disabled={pending}
          />
        </Field>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={pending || rejectReason.trim().length < 3}
            onClick={() => reject.mutate({ id: entry.id, reason: rejectReason.trim() })}
          >
            {reject.isPending ? 'Rejecting…' : 'Reject the return'}
          </button>
        </div>
      </div>
    </Panel>
  )
}
