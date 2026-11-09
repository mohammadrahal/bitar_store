'use client'

import { useState } from 'react'
import { Panel } from '@/components/shared/panel'
import { CashCountField } from '@/components/cash/cash-count-field'
import { useIdempotencyKey } from '@/hooks/use-idempotency-key'
import { useHandOverCashSession } from '@/hooks/use-cash-sessions'
import { needsDifferenceNote } from '@/services/cash-sessions.service'
import { cashSessionTotals } from '@/lib/cash-display'
import { priceOf } from '@/lib/api/map-catalog'
import { formatPrice, formatRelativeDateTime } from '@/lib/format'
import { MAX_CASH_TENDERED, parseMoneyInput } from '@/lib/input-limits'
import { useCurrentUser } from '@/store/user-store'
import type { ApiCashSession } from '@/lib/api/types'

/**
 * Taking the drawer over from the last person.
 *
 * **The person taking it sends this, not the person leaving.** That is the
 * whole point of the call: whoever accepts the drawer counts it first, so the
 * shift that follows starts from a figure they agreed with, and a shortfall
 * belongs to the shift it happened in rather than to whoever happened to be
 * standing there at closing.
 *
 * **Logging out is not a handover.** Signing out leaves the session open and
 * the drawer still owned by the last person to accept it, so this panel says so
 * rather than letting someone assume the drawer was passed on by walking away.
 */
export function CashHandoverPanel({ session, canAccept }: { session: ApiCashSession; canAccept: boolean }) {
  const handOver = useHandOverCashSession()
  const idempotency = useIdempotencyKey()
  const user = useCurrentUser()
  const [counted, setCounted] = useState('')
  const [note, setNote] = useState('')

  const expected = priceOf(cashSessionTotals(session).expectedCash)
  const typed = counted.trim()
  const value = typed === '' ? null : parseMoneyInput(typed, MAX_CASH_TENDERED)
  const noteRequired = value !== null && needsDifferenceNote(value, session)
  const ready = value !== null && (!noteRequired || note.trim().length > 0)

  const handovers = [...session.handovers].reverse()
  const lastHandover = handovers[0]
  /* Who is holding the drawer now: whoever accepted it last, or whoever opened
     it if it has not changed hands. */
  const holder = lastHandover?.to ?? session.openedBy
  const heldByMe = holder.id === user.id

  const submit = () => {
    if (!ready || value === null) return
    handOver.mutate(
      {
        id: session.id,
        countedCash: value,
        note: note.trim() || undefined,
        idempotencyKey: idempotency.current(),
      },
      {
        onSuccess: () => {
          idempotency.reset()
          setCounted('')
          setNote('')
        },
      },
    )
  }

  return (
    <Panel
      title="Take the drawer over"
      description={
        heldByMe
          ? 'You are holding the drawer. The next person counts it and takes it over themselves.'
          : `${holder.name ?? 'Someone else'} is holding the drawer. Count it to take it over.`
      }
    >
      {canAccept ? (
        <form
          className="panel-body stack gap-md"
          style={{ maxWidth: '32rem' }}
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <CashCountField
            label="Count the drawer"
            hint="Count the notes and coins now, before you start selling."
            counted={counted}
            onCountedChange={setCounted}
            expected={expected}
            note={note}
            onNoteChange={setNote}
            noteRequired={noteRequired}
            disabled={handOver.isPending}
          />
          <div className="form-actions">
            <button type="submit" className="btn btn-secondary" disabled={handOver.isPending || !ready}>
              {handOver.isPending ? 'Taking over…' : 'I counted this and I am taking the drawer'}
            </button>
          </div>
          <p className="muted text-sm" style={{ margin: 0 }}>
            Signing out is not a handover: the drawer stays with whoever accepted it last until someone else counts it.
          </p>
        </form>
      ) : (
        <p className="panel-body muted">
          Taking the drawer over needs the cash drawer handover permission. Until then the person holding it stays
          responsible for the count.
        </p>
      )}

      {handovers.length > 0 && (
        <div className="table-wrap">
          <table className="card-table">
            <caption className="sr-only">Handovers on this session, newest first</caption>
            <thead>
              <tr>
                <th scope="col">Taken over by</th>
                <th scope="col" className="num">
                  Counted
                </th>
                <th scope="col" className="num">
                  Difference
                </th>
              </tr>
            </thead>
            <tbody>
              {handovers.map((row) => {
                const difference = priceOf(row.difference)
                return (
                  <tr key={row.id}>
                    <td className="card-title">
                      {row.to.name ?? 'Unknown'}
                      <small>
                        from {row.from.name ?? 'Unknown'} · {formatRelativeDateTime(row.at)}
                        {row.note ? ` · ${row.note}` : ''}
                      </small>
                    </td>
                    <td className="num tabular">{formatPrice(priceOf(row.countedCash))}</td>
                    <td className={`num tabular ${difference !== 0 ? 'detail-alert' : ''}`}>
                      {difference === 0
                        ? 'Balanced'
                        : `${difference > 0 ? '+' : '−'}${formatPrice(Math.abs(difference))}`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
