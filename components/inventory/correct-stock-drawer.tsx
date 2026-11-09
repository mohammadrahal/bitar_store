'use client'

import { AdjustStockDialog } from '@/components/inventory/adjust-stock-dialog'
import { Drawer } from '@/components/shared/drawer'
import { ErrorState } from '@/components/shared/error-state'
import { useVariantDetail } from '@/hooks/use-inventory'
import { usePermission } from '@/hooks/use-permission'

/**
 * The correction drawer opened from a list, where the row knows the variant but
 * not where its units sit.
 *
 * It reads the same per-location balances the side card shows — usually already
 * in cache, because selecting the row fetched them — and hands the ones the
 * viewer may actually correct to the drawer. Without this the only way to a
 * correction was the variant page, which is a navigation away and back for a
 * figure that is two columns to the left.
 */
export function CorrectStockDrawer({
  variantId,
  label,
  code,
  initialBranchId,
  onClose,
}: {
  variantId: string
  label: string
  code: string
  /** The location row this came from, when it came from one. */
  initialBranchId?: string
  onClose: () => void
}) {
  const { data, isPending, isError, error, refetch } = useVariantDetail(variantId)
  const { can, locationAccess } = usePermission()

  if (isPending || isError) {
    return (
      <Drawer
        eyebrow="Correct stock"
        title={label}
        description={code}
        onClose={onClose}
        footer={
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        }
      >
        {isError ? (
          <ErrorState title="Could not read this variant" error={error} onRetry={() => void refetch()} />
        ) : (
          <p className="muted">Reading balances by location…</p>
        )}
      </Drawer>
    )
  }

  /* A correction is audited against a location, so only locations this user
     holds the key for at that location are offered. The server would refuse
     the rest, and a refused action is worse than an absent one. */
  const locations = data.locations.filter(
    (location) => locationAccess(location.branchId) === 'full' && can('stock.adjust', location.branchId),
  )

  if (locations.length === 0) {
    return (
      <Drawer
        eyebrow="Correct stock"
        title={label}
        description={code}
        onClose={onClose}
        footer={
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        }
      >
        <p className="muted">
          Correcting a balance is done at the location that holds it, and you do not have that right at any location
          carrying this variant. A manager there can post the correction.
        </p>
      </Drawer>
    )
  }

  return (
    <AdjustStockDialog
      variantLabel={label}
      skuId={variantId}
      code={code}
      locations={locations}
      initialBranchId={locations.some((location) => location.branchId === initialBranchId) ? initialBranchId : undefined}
      onClose={onClose}
    />
  )
}
