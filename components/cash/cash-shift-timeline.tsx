'use client'

import Link from 'next/link'
import { priceOf } from '@/lib/api/map-catalog'
import type { ApiCashSessionSummary } from '@/lib/api/types'
import { formatPrice, formatShortDate } from '@/lib/format'
import { cashSessionHref, cashSessionListItems, cashSessionTotals, shiftDisplayRef } from '@/lib/cash-display'

export function CashShiftTimeline({
  sessions,
  activeId,
  loading = false,
}: {
  sessions: ApiCashSessionSummary[]
  activeId: string
  loading?: boolean
}) {
  const rows = cashSessionListItems(sessions)

  if (loading) {
    return (
      <section className="cash-shift-timeline" aria-label="Recent shifts at this branch">
        <h2 className="cash-shift-timeline-title">Terminal shift sequence</h2>
        <p className="muted cash-shift-timeline-empty">Loading shifts…</p>
      </section>
    )
  }

  if (rows.length === 0) {
    return (
      <section className="cash-shift-timeline" aria-label="Recent shifts at this branch">
        <h2 className="cash-shift-timeline-title">Terminal shift sequence</h2>
        <p className="muted cash-shift-timeline-empty">No closed shifts listed yet for this branch.</p>
      </section>
    )
  }

  return (
    <section className="cash-shift-timeline" aria-label="Recent shifts at this branch">
      <h2 className="cash-shift-timeline-title">Terminal shift sequence</h2>
      <ol className="cash-shift-timeline-list">
        {rows.map((row) => {
          const isActive = Boolean(activeId) && row.id === activeId
          const net = priceOf(cashSessionTotals(row).salesTotal)
          const closed = row.status === 'closed'
          const flagged = Boolean(row.review?.flagged) && row.review?.reviewedAt == null
          return (
            <li key={row.id} className={isActive ? 'cash-shift-timeline-item--active' : undefined}>
              <Link href={cashSessionHref(row.id)} className="cash-shift-timeline-link">
                <span className="cash-shift-timeline-ref">{shiftDisplayRef(row.id)}</span>
                <span className="cash-shift-timeline-status">
                  {isActive && row.status === 'open'
                    ? 'Open · closing'
                    : flagged
                      ? 'Needs review'
                      : closed
                        ? 'Closed'
                        : 'Open'}
                </span>
                <span className="cash-shift-timeline-meta tabular">
                  {row.closedAt
                    ? formatShortDate(new Date(row.closedAt))
                    : formatShortDate(new Date(row.openedAt))}{' '}
                  · {formatPrice(net)}
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
