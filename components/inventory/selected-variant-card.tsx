'use client'

import Link from 'next/link'
import { ArrowLeftRight, ArrowRight, ClipboardCheck } from 'lucide-react'
import { LocationBalancesTable } from '@/components/inventory/location-balances-table'
import { ErrorState } from '@/components/shared/error-state'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useVariantDetail } from '@/hooks/use-inventory'

/**
 * The selected variant across locations, beside the list.
 *
 * The actions in the foot are the point of the card: it already answers "where
 * are the units", which is the question anyone asks right before moving or
 * correcting them, so the next step belongs here rather than one page away.
 * Both open a drawer over the list; the location is a field inside it, so a
 * send from the branch with the most stock costs no extra click.
 */
export function SelectedVariantCard({
  variantId,
  onCorrect,
  onTransfer,
}: {
  variantId: string
  onCorrect?: () => void
  onTransfer?: () => void
}) {
  const { data, isPending, isError, error, refetch } = useVariantDetail(variantId)

  if (isPending) {
    return (
      <Panel title="By location">
        <div className="panel-body">
          <Skeleton rows={0} stats={0} />
        </div>
      </Panel>
    )
  }
  if (isError) {
    return (
      <Panel title="By location">
        <div className="panel-body">
          <ErrorState title="Could not load this variant" error={error} onRetry={() => void refetch()} />
        </div>
      </Panel>
    )
  }

  return (
    <Panel title={`${data.color} / ${data.size}`} description={`${data.productName} · ${data.sku}`}>
      <LocationBalancesTable locations={data.locations} totals={data.totals} compact />
      {(onTransfer || onCorrect) && (
        <div className="panel-body variant-card-actions">
          {onTransfer && (
            <button type="button" className="btn btn-primary btn-sm" onClick={onTransfer}>
              <ArrowLeftRight size={14} aria-hidden="true" />
              Send stock
            </button>
          )}
          {onCorrect && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onCorrect}>
              <ClipboardCheck size={14} aria-hidden="true" />
              Correct balance
            </button>
          )}
        </div>
      )}
      <div className="panel-foot">
        <Link href={`/inventory/${data.variantId}`} className="link-row">
          View movement history
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </Panel>
  )
}
