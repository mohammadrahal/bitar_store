'use client'

import { useMemo, useState } from 'react'
import { Panel } from '@/components/shared/panel'
import { SkuTableCell } from '@/components/shared/table-empty'
import { formatNumber } from '@/lib/format'
import type { ApiTransferLine } from '@/lib/api/types'

export interface DispatchLineInput {
  skuId: string
  quantity: number
}

function parseQty(text: string): number {
  const value = Number(text)
  return Number.isInteger(value) && value >= 0 ? value : 0
}

/**
 * Sending a transfer out (BL-02 rule 15, the dispatch half).
 *
 * The page used to call dispatch with no `lines` at all, which sends every
 * requested piece or nothing. A branch that asked for ten when the warehouse
 * could spare eight had no way to send the eight. So each line takes the number
 * actually going on the van, capped at what was requested; the remainder stays
 * requested and the transfer stays open.
 *
 * Starts filled in with the full request, because that is the usual case.
 */
export function TransferDispatchPanel({
  lines,
  pending,
  onDispatch,
  secondaryAction,
}: {
  /** Lines with pieces still waiting to be sent. */
  lines: ApiTransferLine[]
  pending: boolean
  onDispatch: (lines: DispatchLineInput[] | undefined) => void
  /** Sits beside the send button, e.g. cancelling the draft. */
  secondaryAction?: React.ReactNode
}) {
  const outstanding = (line: ApiTransferLine) => Math.max(0, line.requested - line.dispatched)

  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(lines.map((line) => [line.sku.id, String(outstanding(line))])),
  )

  const rows = useMemo(
    () =>
      lines.map((line) => {
        const max = outstanding(line)
        const quantity = parseQty(drafts[line.sku.id] ?? '0')
        return { line, max, quantity, over: quantity > max, remaining: Math.max(0, max - quantity) }
      }),
    [drafts, lines],
  )

  const totals = rows.reduce(
    (sum, row) => ({
      sending: sum.sending + row.quantity,
      remaining: sum.remaining + row.remaining,
      requested: sum.requested + row.max,
    }),
    { sending: 0, remaining: 0, requested: 0 },
  )

  const overAsked = rows.find((row) => row.over)
  const payload = rows.filter((row) => row.quantity > 0 && !row.over).map((row) => ({ skuId: row.line.sku.id, quantity: row.quantity }))
  /* Sending the whole request needs no `lines` at all, which keeps the common
     case identical to what the endpoint saw before this panel existed. */
  const sendingEverything = totals.remaining === 0 && payload.length === rows.length

  const problem = overAsked
    ? `${overAsked.line.sku.code}: only ${formatNumber(overAsked.max)} ${
        overAsked.max === 1 ? 'piece was' : 'pieces were'
      } requested.`
    : payload.length === 0
      ? 'Send at least one piece on one line.'
      : null

  return (
    <Panel
      title="Send this transfer"
      description="How many pieces are actually going. Anything left stays requested and the transfer stays open."
    >
      <div className="table-wrap">
        <table className="card-table">
          <caption className="sr-only">Pieces to send per line</caption>
          <thead>
            <tr>
              <th scope="col">SKU</th>
              <th scope="col" className="num">
                Requested
              </th>
              <th scope="col" className="num">
                Sending
              </th>
              <th scope="col" className="num">
                Left behind
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.line.sku.id}>
                <SkuTableCell
                  code={row.line.sku.code}
                  styleName={row.line.sku.styleName}
                  color={row.line.sku.color}
                  size={row.line.sku.size}
                />
                <td className="num tabular">{formatNumber(row.max)}</td>
                <td className="num">
                  <input
                    type="number"
                    min={0}
                    max={row.max}
                    step={1}
                    inputMode="numeric"
                    className="qty-input tabular"
                    aria-invalid={row.over}
                    aria-label={`Pieces to send for ${row.line.sku.code}`}
                    value={drafts[row.line.sku.id] ?? ''}
                    onChange={(event) =>
                      setDrafts((current) => ({ ...current, [row.line.sku.id]: event.target.value }))
                    }
                  />
                </td>
                <td className="num tabular">{formatNumber(row.remaining)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td className="num tabular">{formatNumber(totals.requested)}</td>
              <td className="num tabular">{formatNumber(totals.sending)}</td>
              <td className="num tabular">{formatNumber(totals.remaining)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="panel-body">
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending || Boolean(problem)}
            onClick={() => onDispatch(sendingEverything ? undefined : payload)}
          >
            {pending ? 'Sending…' : `Send ${formatNumber(totals.sending)} pieces`}
          </button>
          {secondaryAction}
          {totals.remaining > 0 && !problem && (
            <p className="muted text-sm">
              {formatNumber(totals.remaining)} {totals.remaining === 1 ? 'piece' : 'pieces'} stay requested at the
              sender and can be sent later.
            </p>
          )}
        </div>
        {problem && <p className="field-error">{problem}</p>}
      </div>
    </Panel>
  )
}
