'use client'

import { useState } from 'react'
import { Panel } from '@/components/shared/panel'
import { useIdempotencyKey } from '@/hooks/use-idempotency-key'
import { useReleaseReturn } from '@/hooks/use-returns'
import { releasableLines, returnConditionLabel, unitsOnHold } from '@/services/returns.service'
import type { ApiReturn } from '@/lib/api/types'

/**
 * Step 3 of 4: putting units back on the shelf.
 *
 * **Nothing is released by default.** Approval moved the goods into the hold
 * and stopped there, and this is the separate act that makes them sellable
 * again — so the form starts at zero per line and a manager types what is
 * actually fit to sell. A form pre-filled with everything would turn a
 * deliberate decision into a confirmation click.
 *
 * The condition is shown beside each line for exactly that judgement: a
 * `damaged` unit sits in the hold until it is written off, and releasing it
 * would put a torn garment back on the rail.
 */
export function ReturnReleasePanel({ entry }: { entry: ApiReturn }) {
  const release = useReleaseReturn()
  const idempotency = useIdempotencyKey()
  const [picked, setPicked] = useState<Record<string, number>>({})

  const lines = releasableLines(entry)
  const onHold = unitsOnHold(entry)
  if (lines.length === 0) return null

  const chosen = Object.entries(picked)
    .filter(([, quantity]) => quantity > 0)
    .map(([returnLineId, quantity]) => ({ returnLineId, quantity }))
  const units = chosen.reduce((total, line) => total + line.quantity, 0)

  const releaseWith = (payload: { returnLineId: string; quantity: number }[] | undefined) =>
    release.mutate(
      { id: entry.id, lines: payload, idempotencyKey: idempotency.current() },
      {
        onSuccess: () => {
          idempotency.reset()
          setPicked({})
        },
      },
    )

  return (
    <Panel
      title="Put units back on sale"
      description={`${onHold} ${onHold === 1 ? 'unit is' : 'units are'} on hold at ${
        entry.receivingBranch.name
      }. Releasing is a separate decision from approving, and only what is fit to sell should go back.`}
    >
      <div className="panel-body stack gap-md">
        <div className="table-wrap">
          <table className="card-table">
            <caption className="sr-only">Units on hold, and how many to release</caption>
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Condition</th>
                <th scope="col" className="num">
                  On hold
                </th>
                <th scope="col" className="num">
                  Release
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.id}>
                  <td className="card-title">
                    {line.description}
                    <small>{line.sku.code}</small>
                  </td>
                  <td data-label="Condition">
                    <span className={line.condition === 'as_new' ? undefined : 'detail-alert'}>
                      {returnConditionLabel(line.condition)}
                    </span>
                  </td>
                  <td className="num tabular" data-label="On hold">
                    {line.onHold}
                  </td>
                  <td className="num" data-label="Release">
                    <input
                      type="number"
                      className="qty-input tabular"
                      min={0}
                      max={line.onHold}
                      step={1}
                      value={picked[line.id] ?? 0}
                      disabled={release.isPending}
                      aria-label={`Units of ${line.sku.code} to put back on sale`}
                      onChange={(event) => {
                        const raw = Number(event.target.value)
                        const quantity = Number.isFinite(raw)
                          ? Math.max(0, Math.min(line.onHold, Math.trunc(raw)))
                          : 0
                        const next = { ...picked }
                        if (quantity === 0) delete next[line.id]
                        else next[line.id] = quantity
                        setPicked(next)
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={release.isPending || units === 0}
            onClick={() => releaseWith(chosen)}
          >
            {release.isPending
              ? 'Releasing…'
              : units === 0
                ? 'Choose what to release'
                : `Release ${units} ${units === 1 ? 'unit' : 'units'}`}
          </button>
          {onHold > 0 && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={release.isPending}
              onClick={() => releaseWith(undefined)}
            >
              Release all {onHold}
            </button>
          )}
        </div>

        <p className="muted text-sm" style={{ margin: 0 }}>
          Releasing moves stock and pays nothing. The refund is separate, below.
        </p>
      </div>
    </Panel>
  )
}
