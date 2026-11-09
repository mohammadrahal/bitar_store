'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AdjustStockDialog } from '@/components/inventory/adjust-stock-dialog'
import { BalanceTiles } from '@/components/inventory/balance-tiles'
import { LocationBalancesTable } from '@/components/inventory/location-balances-table'
import { QuickTransferDrawer } from '@/components/inventory/quick-transfer-drawer'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { Skeleton } from '@/components/shared/skeleton'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useVariantDetail } from '@/hooks/use-inventory'
import { usePermission } from '@/hooks/use-permission'
import { variantLabel } from '@/lib/variant-label'
import type { LocationBalance } from '@/types'

export function VariantDetailView({ variantId }: { variantId: string }) {
  const { data, isPending, isError, error, refetch } = useVariantDetail(variantId)
  const { can, locationAccess, canRequestTransfer } = usePermission()
  const [adjusting, setAdjusting] = useState<LocationBalance | null>(null)
  const [sendingFrom, setSendingFrom] = useState<LocationBalance | null>(null)
  useDocumentTitle(data && `${data.productName} ${data.color} / ${data.size}`)

  /* Correcting a balance is a manager's job and is audited under their name, so
     the action is absent for everyone else rather than shown and refused. */
  const mayAdjust = can('stock.adjust')
  const maySend = canRequestTransfer()

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
            <Panel
              title="By location"
              description={
                mayAdjust
                  ? 'Only locations you can see are listed. Correct a figure against a physical count, or send units on from where they are.'
                  : 'Only locations you can see are listed.'
              }
            >
              <LocationBalancesTable
                locations={data.locations}
                totals={data.totals}
                onAdjust={mayAdjust ? setAdjusting : undefined}
                /* Sending starts at the row someone is reading, so the source is
                   decided by the click and only the destination is left to pick. */
                onSend={maySend ? setSendingFrom : undefined}
              />
            </Panel>
          </div>

          {adjusting && (
            <AdjustStockDialog
              variantLabel={variantLabel({ productName: data.productName, color: data.color, size: data.size })}
              skuId={data.variantId}
              code={data.sku}
              locations={data.locations.filter(
                (location) => locationAccess(location.branchId) === 'full' && can('stock.adjust', location.branchId),
              )}
              initialBranchId={adjusting.branchId}
              onClose={() => setAdjusting(null)}
            />
          )}

          {sendingFrom && (
            <QuickTransferDrawer
              variants={[
                {
                  variantId: data.variantId,
                  label: variantLabel({ productName: data.productName, color: data.color, size: data.size }),
                  sku: data.sku,
                },
              ]}
              initialSourceId={sendingFrom.branchId}
              onClose={() => setSendingFrom(null)}
            />
          )}
        </>
      )}
    </>
  )
}
