'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { ReturnDecisionPanel } from '@/components/returns/return-decision-panel'
import { ReturnExchangePanel } from '@/components/returns/return-exchange-panel'
import { ReturnHandbackPanel } from '@/components/returns/return-handback-panel'
import { ReturnRefundPanel } from '@/components/returns/return-refund-panel'
import { ReturnReleasePanel } from '@/components/returns/return-release-panel'
import { ReturnStatusPill } from '@/components/returns/return-status-pill'
import { ReturnSteps } from '@/components/returns/return-steps'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { usePermission } from '@/hooks/use-permission'
import { useReturn } from '@/hooks/use-returns'
import { priceOf } from '@/lib/api/map-catalog'
import { formatPrice, formatRelativeDateTime } from '@/lib/format'
import { returnsHubHref } from '@/lib/returns-hub'
import { canHandBackReturn, returnConditionLabel } from '@/services/returns.service'

/**
 * One return, and everything that can still be done to it.
 *
 * The panels appear **only when their step is actually available**, in the order
 * the business rules put them: decide, then release, then refund, with the
 * exchange last because it is optional and settles nothing. That is why there is
 * no single "process return" button anywhere on this page — four acts, four
 * panels, and a reader can see which are still open from the steps at the top.
 */
export function ReturnDetailView({ returnId }: { returnId: string }) {
  const { data: entry, isPending, isError, error, refetch } = useReturn(returnId)
  const { canDecideReturns, canRefundReturns, canRecordReturns } = usePermission()

  useDocumentTitle(entry ? `Return ${entry.reference}` : undefined)

  if (isPending) return <Skeleton rows={4} stats={0} />
  if (isError || !entry) {
    return (
      <ErrorState title="Could not load this return" error={error} onRetry={() => void refetch()} />
    )
  }

  const mayDecide = canDecideReturns()
  const units = entry.lines.reduce((total, line) => total + line.quantity, 0)

  return (
    <>
      <Link href={returnsHubHref('record')} className="back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        Returns
      </Link>
      <PageHeader
        eyebrow="Return"
        title={entry.reference}
        description={`${units} ${units === 1 ? 'unit' : 'units'} taken in ${formatRelativeDateTime(
          entry.receivedAt,
        )} at ${entry.receivingBranch.name} by ${entry.receivedBy.name ?? 'Unknown'} · ${entry.reason}`}
      />

      <div className="detail-meta">
        <ReturnStatusPill status={entry.status} />
        <Link href={`/sales/${entry.sale.id}`} className="text-link">
          Sale {entry.sale.reference}
        </Link>
        <span className="muted">
          sold at {entry.sale.branch.name} · {formatRelativeDateTime(entry.sale.soldAt)}
        </span>
      </div>

      {entry.note ? <p className="section-note muted">Note: {entry.note}</p> : null}
      {entry.lateExceptionReason ? (
        <p className="section-note">
          Taken back past the return window. Reason given: {entry.lateExceptionReason}
        </p>
      ) : null}

      <ReturnSteps entry={entry} />

      <Panel title="What came back">
        <div className="table-wrap">
          <table className="card-table">
            <caption className="sr-only">Lines on this return</caption>
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Condition</th>
                <th scope="col" className="num">
                  Units
                </th>
                <th scope="col" className="num">
                  On hold
                </th>
                <th scope="col" className="num">
                  Refund
                </th>
              </tr>
            </thead>
            <tbody>
              {entry.lines.map((line) => (
                <tr key={line.id}>
                  <td className="card-title">
                    {line.description}
                    <small>
                      {line.sku.code}
                      {line.releasedQty > 0 ? ` · ${line.releasedQty} back on sale` : ''}
                    </small>
                  </td>
                  <td data-label="Condition">
                    <span className={line.condition === 'as_new' ? undefined : 'detail-alert'}>
                      {returnConditionLabel(line.condition)}
                    </span>
                  </td>
                  <td className="num tabular" data-label="Units">
                    {line.quantity}
                  </td>
                  <td className="num tabular" data-label="On hold">
                    {line.onHold}
                  </td>
                  <td className="num tabular" data-label="Refund">
                    {line.refundValue === null ? 'Not set' : formatPrice(priceOf(line.refundValue))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {entry.status === 'in_custody' ? (
          <p className="panel-body muted text-sm section-note">
            The refund is set when a manager approves this return: the amount actually paid for
            these units, after any discount on the sale.
          </p>
        ) : null}
      </Panel>

      {mayDecide ? <ReturnDecisionPanel entry={entry} /> : null}
      {!mayDecide && entry.status === 'in_custody' ? (
        <Panel title="Waiting on a manager">
          <p className="panel-body muted">
            Approving or rejecting a return is a manager&rsquo;s decision, whatever permissions are
            granted. The goods stay in custody until then and no stock has moved.
          </p>
        </Panel>
      ) : null}

      {canHandBackReturn(entry) ? (
        <ReturnHandbackPanel entry={entry} canRecord={canRecordReturns()} />
      ) : null}

      {mayDecide && entry.status === 'approved' ? <ReturnReleasePanel entry={entry} /> : null}

      {entry.status === 'approved' ? (
        <ReturnRefundPanel entry={entry} canPay={canRefundReturns()} />
      ) : null}

      {entry.status === 'approved' ? <ReturnExchangePanel entry={entry} /> : null}
    </>
  )
}
