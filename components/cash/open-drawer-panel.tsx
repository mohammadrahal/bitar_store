'use client'

import { useState } from 'react'
import { Field } from '@/components/shared/field'
import { Panel } from '@/components/shared/panel'
import { useIdempotencyKey } from '@/hooks/use-idempotency-key'
import { useOpenCashSession } from '@/hooks/use-cash-sessions'
import { formatPrice } from '@/lib/format'
import { MAX_CASH_TENDERED, parseMoneyInput } from '@/lib/input-limits'

/**
 * Opening the drawer for the day.
 *
 * The float is the cash already in the till before the first sale, and it is
 * the base of every expected-cash figure for the rest of the shift, so it is
 * typed once and cannot be edited afterwards — only corrected by a manager,
 * with a reason, after the session closes.
 */
export function OpenDrawerPanel({
  branchId,
  branchName,
  canOpen,
}: {
  branchId: string
  branchName: string
  canOpen: boolean
}) {
  const open = useOpenCashSession()
  const idempotency = useIdempotencyKey()
  const [float, setFloat] = useState('')
  const [note, setNote] = useState('')

  const typed = float.trim()
  const openingCash = typed === '' ? null : parseMoneyInput(typed, MAX_CASH_TENDERED)

  const submit = () => {
    if (openingCash === null) return
    open.mutate(
      {
        branchId,
        openingCash,
        note: note.trim() || undefined,
        idempotencyKey: idempotency.current(),
      },
      { onSuccess: idempotency.reset },
    )
  }

  if (!canOpen) {
    return (
      <Panel
        className="cash-z-panel cash-z-open-panel"
        title="The drawer is closed"
        description={`No one has opened the drawer at ${branchName} yet.`}
      >
        <p className="panel-body muted">
          Ask a manager, or someone with the cash drawer permission, to open it. Until then sales may be refused at
          this till.
        </p>
      </Panel>
    )
  }

  return (
    <Panel
      className="cash-z-panel cash-z-open-panel"
      title="Start shift — open the drawer"
      description={`Count what is in the till at ${branchName} before the first sale.`}
    >
      <form
        className="panel-body stack gap-md cash-z-open-form"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <Field
          label="Opening float"
          hint="The cash in the drawer right now. Enter 0 if it is empty."
        >
          <input
            type="text"
            inputMode="decimal"
            className="tabular"
            value={float}
            placeholder="0"
            autoFocus
            onChange={(event) => setFloat(event.target.value.replace(/[^\d.]/g, ''))}
          />
        </Field>
        <Field label="Note (optional)" hint="Anything worth recording about how the shift started.">
          <textarea
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Took over from the night shift with the safe float"
          />
        </Field>
        <div className="form-actions">
          <button type="submit" className="btn btn-primary cash-z-open-submit" disabled={open.isPending || openingCash === null}>
            {open.isPending
              ? 'Opening…'
              : openingCash === null
                ? 'Open the drawer'
                : `Open with ${formatPrice(openingCash)}`}
          </button>
        </div>
        <p className="muted text-sm" style={{ margin: 0 }}>
          Every sale at this branch is attached to this session by the server until it is closed.
        </p>
      </form>
    </Panel>
  )
}
