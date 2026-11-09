'use client'

import { useMemo, useState } from 'react'
import { Panel } from '@/components/shared/panel'
import { SkuTableCell } from '@/components/shared/table-empty'
import { formatNumber } from '@/lib/format'
import type { ApiTransferLine } from '@/lib/api/types'

export interface ReceiveLineInput {
  skuId: string
  accepted: number
  damaged: number
}

/** The server takes 1 to 500 characters, so the box stops at 500. */
const MAX_NOTE = 500

interface Draft {
  accepted: string
  damaged: string
}

function parseQty(text: string): number {
  const value = Number(text)
  return Number.isInteger(value) && value >= 0 ? value : 0
}

/**
 * Counting a shipment in at the destination (BL-02 rules 15 and 16).
 *
 * Both halves of those rules used to be impossible here. The detail page sent
 * `{ accepted: line.onTheRoad, damaged: 0 }` — every line in full, damage
 * hardcoded to zero — so a partial receipt could not be recorded and damaged
 * goods were received as good stock and later released for sale.
 *
 * So each line takes two counts. Per the API both land in the destination's
 * **on hold** bucket; only the accepted ones can later be released to the shelf,
 * which is what keeps rule 16's damaged units out of sale. Anything left
 * uncounted stays on the road and the transfer stays open (rule 15).
 *
 * The form starts with everything accepted and nothing damaged, because that is
 * what most shipments are — the counts are there to be corrected, not typed
 * from scratch.
 *
 * The inspector's note goes **with this request**. It used to be typed on the
 * report page and kept in `sessionStorage`, where it was lost on the next tab
 * and never reached the warehouse. `POST /transfers/:id/receive` takes it, and
 * it comes back on `transfer.receipts[]` against the pass it describes.
 */
export function TransferReceivePanel({
  lines,
  pending,
  onReceive,
}: {
  /** Lines with units still on the road. */
  lines: ApiTransferLine[]
  pending: boolean
  onReceive: (lines: ReceiveLineInput[], note?: string) => void
}) {
  const [note, setNote] = useState('')
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(lines.map((line) => [line.sku.id, { accepted: String(line.onTheRoad), damaged: '0' }])),
  )

  const set = (skuId: string, patch: Partial<Draft>) =>
    setDrafts((current) => ({
      ...current,
      [skuId]: { ...(current[skuId] ?? { accepted: '0', damaged: '0' }), ...patch },
    }))

  const rows = useMemo(
    () =>
      lines.map((line) => {
        const draft = drafts[line.sku.id] ?? { accepted: '0', damaged: '0' }
        const accepted = parseQty(draft.accepted)
        const damaged = parseQty(draft.damaged)
        const counted = accepted + damaged
        return {
          line,
          draft,
          accepted,
          damaged,
          counted,
          /* The server refuses more than is still on the way, so say it here
             instead of letting it come back as a 409. */
          over: counted > line.onTheRoad,
          remaining: Math.max(0, line.onTheRoad - counted),
        }
      }),
    [drafts, lines],
  )

  const totals = rows.reduce(
    (sum, row) => ({
      accepted: sum.accepted + row.accepted,
      damaged: sum.damaged + row.damaged,
      remaining: sum.remaining + row.remaining,
    }),
    { accepted: 0, damaged: 0, remaining: 0 },
  )

  const overCounted = rows.filter((row) => row.over)
  const payload = rows
    .filter((row) => row.counted > 0 && !row.over)
    .map((row) => ({ skuId: row.line.sku.id, accepted: row.accepted, damaged: row.damaged }))

  const problem =
    overCounted.length > 0
      ? `${overCounted[0].line.sku.code}: only ${formatNumber(overCounted[0].line.onTheRoad)} ${
          overCounted[0].line.onTheRoad === 1 ? 'piece is' : 'pieces are'
        } still on the way.`
      : payload.length === 0
        ? 'Count at least one piece on one line.'
        : null

  return (
    <Panel
      title="Receive this shipment"
      description="Count what arrived. Damaged pieces stay on hold and are never released for sale; anything uncounted stays on the road."
    >
      <div className="table-wrap">
        <table className="card-table">
          <caption className="sr-only">Count accepted and damaged pieces per line</caption>
          <thead>
            <tr>
              <th scope="col">SKU</th>
              <th scope="col" className="num">
                On the road
              </th>
              <th scope="col" className="num">
                Good
              </th>
              <th scope="col" className="num">
                Damaged
              </th>
              <th scope="col" className="num">
                Still on the road
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
                <td className="num tabular">{formatNumber(row.line.onTheRoad)}</td>
                <td className="num">
                  <input
                    type="number"
                    min={0}
                    max={row.line.onTheRoad}
                    step={1}
                    inputMode="numeric"
                    className="qty-input tabular"
                    aria-invalid={row.over}
                    aria-label={`Good pieces received for ${row.line.sku.code}`}
                    value={row.draft.accepted}
                    onChange={(event) => set(row.line.sku.id, { accepted: event.target.value })}
                  />
                </td>
                <td className="num">
                  <input
                    type="number"
                    min={0}
                    max={row.line.onTheRoad}
                    step={1}
                    inputMode="numeric"
                    className="qty-input tabular"
                    aria-invalid={row.over}
                    aria-label={`Damaged pieces received for ${row.line.sku.code}`}
                    value={row.draft.damaged}
                    onChange={(event) => set(row.line.sku.id, { damaged: event.target.value })}
                  />
                </td>
                <td className="num tabular">{formatNumber(row.remaining)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row">Total</th>
              <td className="num tabular">
                {formatNumber(lines.reduce((sum, line) => sum + line.onTheRoad, 0))}
              </td>
              <td className="num tabular">{formatNumber(totals.accepted)}</td>
              <td className="num tabular">{formatNumber(totals.damaged)}</td>
              <td className="num tabular">{formatNumber(totals.remaining)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="panel-body stack gap-sm">
        <label className="stack gap-xs transfer-note-field">
          <span className="settings-row-title">Note on this count (optional)</span>
          <textarea
            className="input"
            rows={3}
            maxLength={MAX_NOTE}
            placeholder="Short crate, two boxes soaked, seal already broken…"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <span className="muted text-sm">
            Recorded against this count on the transfer, where the warehouse and the receiving report both read it.
            {note.length > MAX_NOTE - 100 ? ` ${MAX_NOTE - note.length} characters left.` : ''}
          </span>
        </label>
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending || Boolean(problem)}
            onClick={() => onReceive(payload, note.trim() || undefined)}
          >
            {pending ? 'Receiving…' : `Receive ${formatNumber(totals.accepted + totals.damaged)} pieces (on hold)`}
          </button>
          {totals.remaining > 0 && !problem && (
            <p className="muted text-sm">
              {formatNumber(totals.remaining)} {totals.remaining === 1 ? 'piece' : 'pieces'} stay on the road and
              the transfer stays open.
            </p>
          )}
        </div>
        {problem && <p className="field-error">{problem}</p>}
        {totals.damaged > 0 && (
          <p className="muted text-sm">
            {formatNumber(totals.damaged)} damaged {totals.damaged === 1 ? 'piece' : 'pieces'} will be held at this
            location and left out of the release for sale. Say what is wrong with them in the note above.
          </p>
        )}
      </div>
    </Panel>
  )
}
