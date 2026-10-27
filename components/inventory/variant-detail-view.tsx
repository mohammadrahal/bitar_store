'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { BalanceTiles } from '@/components/inventory/balance-tiles'
import { LocationBalancesTable } from '@/components/inventory/location-balances-table'
import { MovementTable } from '@/components/inventory/movement-table'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useVariantDetail } from '@/hooks/use-inventory'

export function VariantDetailView({ variantId }: { variantId: string }) {
  const { data, isPending, isError, error, refetch } = useVariantDetail(variantId)

  return (
    <>
      <Link href="/inventory" className="back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        Inventory
      </Link>
      {isPending ? (
        <Skeleton rows={4} stats={5} />
      ) : isError ? (
        <ErrorState title="Could not load this variant" error={error} onRetry={() => void refetch()} />
      ) : (
        <>
          <PageHeader
            eyebrow={`${data.productCode} · ${data.sku}`}
            title={`${data.productName} ${data.color} / ${data.size}`}
            description={data.archived ? 'This model is archived. Its history stays readable.' : data.category}
            actions={
              <Link href={`/products/${data.productId}`} className="btn btn-secondary">
                View model
              </Link>
            }
          />
          <div className="stack">
            <BalanceTiles totals={data.totals} />
            <Panel title="By location" description="Only locations you can see are listed.">
              <LocationBalancesTable locations={data.locations} totals={data.totals} />
            </Panel>
            <Panel title="Movement history" description="Every change to this variant, newest first.">
              <MovementTable movements={data.movements} />
            </Panel>
          </div>
        </>
      )}
    </>
  )
}
