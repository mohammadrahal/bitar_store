'use client'

import { seriesColor } from '@/lib/chart-palette'
import { formatPrice } from '@/lib/format'
import type { RevenueSplit } from '@/services/dashboard-trend.service'

function shareOf(amount: number, total: number) {
  if (total <= 0) return 0
  return Math.round((amount / total) * 1000) / 10
}

/**
 * One whole split into two parts, read beside its figures: a thin segmented
 * bar with no text on it, and a row per part carrying the name, the amount and
 * the share. The swatch on each row is the legend, so the bar itself stays
 * silent. A part at zero draws no segment.
 *
 * Shares are taken against the parts shown rather than against gross revenue,
 * so the bar always reads as a whole. the server excludes change given back,
 * and a bar that stopped short of its track would look like a rendering fault
 * rather than the rounding it is.
 */
function Split({ split, colorOffset }: { split: RevenueSplit; colorOffset: number }) {
  const total = split.parts.reduce((sum, part) => sum + part.amount, 0)

  return (
    <div className="revenue-split">
      <p className="revenue-split-label">{split.label}</p>

      {total > 0 ? (
        <div
          className="split-bar"
          role="img"
          aria-label={split.parts
            .map((part) => `${part.name} ${formatPrice(part.amount)}, ${shareOf(part.amount, total)}%`)
            .join('. ')}
        >
          {split.parts.map((part, index) =>
            part.amount > 0 ? (
              <span
                key={part.id}
                className="split-bar-part"
                style={{
                  flexGrow: part.amount,
                  background: seriesColor(part.id, colorOffset + index),
                }}
              />
            ) : null,
          )}
        </div>
      ) : (
        <div className="split-bar split-bar-empty" aria-hidden="true" />
      )}

      <ul className="split-rows">
        {split.parts.map((part, index) => (
          <li key={part.id}>
            <span
              className="chart-swatch"
              style={{ background: seriesColor(part.id, colorOffset + index) }}
              aria-hidden="true"
            />
            <span className="split-name">{part.name}</span>
            <span className="split-share tabular">{total > 0 ? `${shareOf(part.amount, total)}%` : ''}</span>
            <strong className="split-amount tabular">{formatPrice(part.amount)}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Payment and channel are two different splits of the same revenue. cash plus
 * Whish is one whole, in store plus social media is another. so they are two
 * bars rather than one four-part bar, which would count every sale twice. Each
 * split takes the next pair of hues so no colour means two things on screen.
 */
export function RevenueSplits({ splits }: { splits: RevenueSplit[] }) {
  let offset = 0
  return (
    <div className="revenue-splits">
      {splits.map((split) => {
        const colorOffset = offset
        offset += split.parts.length
        return <Split key={split.label} split={split} colorOffset={colorOffset} />
      })}
    </div>
  )
}
