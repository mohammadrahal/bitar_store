'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { CashByUserTable } from '@/components/cash/cash-by-user-table'
import { CashClosingComparison } from '@/components/cash/cash-closing-comparison'
import { CashReviewPanel } from '@/components/cash/cash-review-panel'
import { CashTotalsTiles } from '@/components/cash/cash-totals-tiles'
import { useCashSession } from '@/hooks/use-cash-sessions'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { usePermission } from '@/hooks/use-permission'
import { priceOf } from '@/lib/api/map-catalog'
import { actorName } from '@/lib/cash-display'
import { cashHubHref } from '@/lib/cash-hub'
import { formatPrice, formatRelativeDateTime } from '@/lib/format'

/**
 * One shift, read back.
 *
 * A closed session is a record, so nothing here changes the money except a
 * manager's correction — which is itself recorded rather than applied over the
 * original count. An open session shows the same figures but sends the reader
 * to the drawer screen, where the actions live.
 */
export function CashSessionDetailView({ sessionId }: { sessionId: string }) {
  const { data: session, isPending, isError, error, refetch } = useCashSession(sessionId)
  const { can, role } = usePermission()

  useDocumentTitle(session ? `Shift at ${session.branch.name}` : undefined)

  if (isPending) return <Skeleton rows={4} stats={4} />
  if (isError || !session) {
    return <ErrorState title="Could not load this shift" error={error} onRetry={() => void refetch()} />
  }

  /* Corrections and sign-off are the server's manager-only calls. Both owner
     roles qualify; an employee with `cash.close` does not. */
  const isOwner = role === 'super_admin' || role === 'manager'
  const canReview = isOwner && session.status === 'closed'
  const movements = [...session.movements].reverse()

  return (
    <>
      <Link href={cashHubHref('shifts')} className="back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        Shifts
      </Link>
      <PageHeader
        eyebrow="Till"
        title={`Shift at ${session.branch.name}`}
        description={`Opened ${formatRelativeDateTime(session.openedAt)} by ${session.openedBy.name ?? 'Unknown'}${
          session.closedAt ? ` · closed ${formatRelativeDateTime(session.closedAt)}` : ''
        }`}
      />

      <div className="detail-meta">
        {session.status === 'open' ? (
          <>
            <span className="pill pill-healthy">
              <span className="pill-dot" aria-hidden="true" />
              Still open
            </span>
            {can('cash.open', session.branch.id) || can('cash.close', session.branch.id) ? (
              <Link href={cashHubHref('drawer')} className="text-link">
                Open the drawer screen to act on it
              </Link>
            ) : null}
          </>
        ) : session.review.flagged && session.review.reviewedAt === null ? (
          <span className="pill pill-out">
            <span className="pill-dot" aria-hidden="true" />
            Needs a manager’s review
          </span>
        ) : (
          <span className="pill pill-neutral">
            <span className="pill-dot" aria-hidden="true" />
            {session.review.reviewedAt !== null ? 'Reviewed' : 'Closed'}
          </span>
        )}
      </div>

      {session.note ? <p className="section-note muted">Opening note: {session.note}</p> : null}

      <CashTotalsTiles session={session} />

      <CashClosingComparison
        closing={session.closing}
        effective={session.effective}
        corrections={session.corrections}
      />

      <CashByUserTable rows={session.byUser} />

      {movements.length > 0 && (
        <Panel title="Cash in and out" description="Money that moved on this session without a sale.">
          <div className="table-wrap">
            <table className="card-table">
              <caption className="sr-only">Cash movements, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Reason</th>
                  <th scope="col">By</th>
                  <th scope="col" className="num">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement) => (
                  <tr key={movement.id}>
                    <td className="card-title">
                      {movement.reason}
                      <small>{formatRelativeDateTime(movement.at)}</small>
                    </td>
                    <td>{actorName(movement.by)}</td>
                    <td className={`num tabular ${movement.direction === 'out' ? 'detail-alert' : ''}`}>
                      {movement.direction === 'out' ? '−' : '+'}
                      {formatPrice(priceOf(movement.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {session.handovers.length > 0 && (
        <Panel title="Handovers" description="Each time someone counted the drawer and took it over.">
          <div className="table-wrap">
            <table className="card-table">
              <caption className="sr-only">Handovers, oldest first</caption>
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
                {session.handovers.map((row) => {
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
        </Panel>
      )}

      {canReview && <CashReviewPanel session={session} />}
    </>
  )
}
