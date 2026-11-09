'use client'

import Link from 'next/link'
import { Boxes, ClipboardList, PackagePlus } from 'lucide-react'
import { Can } from '@/components/shared/can'
import { useBranches } from '@/hooks/use-branches'
import { useBranchScope } from '@/hooks/use-branch-scope'
import { ALL_BRANCHES } from '@/types'
import { adminHubHref } from '@/lib/admin-hub'

/** Explains that stock on the product page is read-only and where to see or set it. */
export function ProductStockHint({
  productCode,
  justCreated = false,
}: {
  productCode: string
  /** Arrived straight from saving the model: lead with why everything is zero. */
  justCreated?: boolean
}) {
  const scope = useBranchScope()
  const { data: branches } = useBranches()

  const scopeLabel =
    scope === ALL_BRANCHES
      ? 'All locations (totals in the Stock column)'
      : scope === '__none__'
        ? 'Choose a location in the header to see branch stock'
        : (branches?.find((branch) => branch.id === scope)?.name ?? 'This location')

  return (
    <div className="product-stock-hint" role="note">
      <p className="muted">
        {justCreated ? (
          <>
            <strong>Saved. Stock is zero everywhere.</strong> Adding a model to the catalog never places pieces. book
            in the delivery it came with, or post an opening count.
          </>
        ) : (
          <>
            <strong>Stock is read-only here.</strong> A new model starts at zero everywhere; adding it to the catalog
            never places pieces.
          </>
        )}{' '}
        Figures are for <span className="tabular">{scopeLabel}</span>. Tap a variant or its quantity to open full
        balances by location. Quantities change by <em>receiving</em> a delivery, an opening count, transfers or
        sales. never from the catalog.
      </p>
      <div className="product-stock-hint-actions">
        <Link href="/inventory" className="btn btn-secondary btn-sm">
          <Boxes size={16} aria-hidden="true" />
          Inventory
        </Link>
        {/* The usual answer to "it says zero": stock arrived and nobody booked
            it in. This is that form, so it leads. */}
        <Can permission="stock.adjust">
          <Link
            href={`/stock-receipts/new?style=${encodeURIComponent(productCode)}`}
            className={`btn btn-sm ${justCreated ? 'btn-primary' : 'btn-secondary'}`}
          >
            <PackagePlus size={16} aria-hidden="true" />
            Receive stock
          </Link>
        </Can>
        <Can permission="opening_stock.post">
          <Link href={adminHubHref('opening-stock')} className="btn btn-secondary btn-sm">
            <ClipboardList size={16} aria-hidden="true" />
            Opening stock
          </Link>
        </Can>
        <Link href={`/inventory?search=${encodeURIComponent(productCode)}`} className="text-link text-sm">
          Find {productCode} in inventory
        </Link>
      </div>
    </div>
  )
}
