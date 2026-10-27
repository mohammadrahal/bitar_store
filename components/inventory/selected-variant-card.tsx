'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { LocationBalancesTable } from '@/components/inventory/location-balances-table'
import { ErrorState } from '@/components/shared/error-state'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useVariantDetail } from '@/hooks/use-inventory'

export function SelectedVariantCard({ variantId }: { variantId: string }) {
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
      <div className="panel-foot">
        <Link href={`/inventory/${data.variantId}`} className="link-row">
          View movement history
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </Panel>
  )
}
