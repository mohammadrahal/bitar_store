'use client'

import { actorName } from '@/lib/cash-display'
import { Panel } from '@/components/shared/panel'
import { priceOf } from '@/lib/api/map-catalog'
import { formatPrice, formatRelativeDateTime } from '@/lib/format'
import type { ApiCashClosing, ApiCashCorrection } from '@/lib/api/types'

const FIELD_LABEL: Record<ApiCashCorrection['field'], string> = {
  openingCash: 'Opening float',
  countedCash: 'Counted at closing',
  cashRemoved: 'Taken to the safe',
}

function signedMoney(value: number): string {
  if (value === 0) return 'Balanced'
  return `${value > 0 ? '+' : '−'}${formatPrice(Math.abs(value))}`
}

/**
 * The closing as it was recorded, beside the closing as it now stands.
 *
 * A manager's correction does not overwrite the count: the server keeps
 * `closing` (what the cashier actually counted and signed) and `effective` (the
 * same closing with the corrections applied), and both are shown side by side.
 * Replacing one with the other would erase the only evidence of what was
 * originally found in the drawer, which is the thing a discrepancy
 * investigation needs.
 *
 * With no corrections the two are identical, so only one column is drawn.
 */
export function CashClosingComparison({
  closing,
  effective,
  corrections,
}: {
  closing: ApiCashClosing | null
  effective: ApiCashClosing | null
  corrections: ApiCashCorrection[]
}) {
  if (!closing) return null

  const corrected = corrections.length > 0 && effective !== null
  const rows: { label: string; pick: (c: ApiCashClosing) => string }[] = [
    { label: 'Counted in the drawer', pick: (c) => formatPrice(priceOf(c.countedCash)) },
    { label: 'Expected in the drawer', pick: (c) => formatPrice(priceOf(c.expectedCash)) },
    { label: 'Difference', pick: (c) => signedMoney(priceOf(c.difference)) },
    { label: 'Taken to the safe', pick: (c) => formatPrice(priceOf(c.cashRemoved)) },
    { label: 'Left as tomorrow’s float', pick: (c) => formatPrice(priceOf(c.cashLeft)) },
  ]

  return (
    <Panel
      title="The closing"
      description={
        corrected
          ? 'What was counted, and what it stands at after a manager’s correction. The original count is never overwritten.'
          : `Counted by ${actorName(closing.by)}${closing.at ? ` ${formatRelativeDateTime(closing.at)}` : ''}.`
      }
    >
      <div className="table-wrap">
        <table className="card-table">
          <caption className="sr-only">Closing figures{corrected ? ', as counted and as corrected' : ''}</caption>
          <thead>
            <tr>
              <th scope="col">Figure</th>
              <th scope="col" className="num">
                {corrected ? 'As counted' : 'Amount'}
              </th>
              {corrected && (
                <th scope="col" className="num">
                  After corrections
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const original = row.pick(closing)
              const now = effective ? row.pick(effective) : original
              return (
                <tr key={row.label}>
                  <td className="card-title">{row.label}</td>
                  <td className="num tabular">{original}</td>
                  {corrected && (
                    <td className={`num tabular ${now !== original ? 'detail-alert' : ''}`}>{now}</td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {closing.differenceNote ? (
        <p className="panel-body muted" style={{ margin: 0 }}>
          <strong>Why it differed:</strong> {closing.differenceNote}
        </p>
      ) : null}

      {corrections.length > 0 && (
        <div className="table-wrap">
          <table className="card-table">
            <caption className="sr-only">Corrections to this closing</caption>
            <thead>
              <tr>
                <th scope="col">Correction</th>
                <th scope="col">By</th>
                <th scope="col" className="num">
                  Set to
                </th>
              </tr>
            </thead>
            <tbody>
              {corrections.map((correction) => (
                <tr key={correction.id}>
                  <td className="card-title">
                    {FIELD_LABEL[correction.field]}
                    <small>
                      {correction.reason} · {formatRelativeDateTime(correction.at)}
                    </small>
                  </td>
                  <td>{actorName(correction.by)}</td>
                  <td className="num tabular">{formatPrice(priceOf(correction.value))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
