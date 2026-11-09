'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo } from 'react'
import {
  ArrowLeftRight,
  PackageCheck,
  PackagePlus,
  Plus,
  Truck,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { parseInventoryFilter } from '@/lib/inventory-filters'
import { InventoryVariantsView } from '@/components/inventory/inventory-variants-view'
import { ReplenishmentView } from '@/components/warehouse/replenishment-view'
import { StockReceiptsView } from '@/components/stock-receipts/stock-receipts-view'
import { TransfersView } from '@/components/transfers/transfers-view'
import { PageHeader } from '@/components/shared/page-header'
import { useBranchScope } from '@/hooks/use-branch-scope'
import { useEffectiveListBranchId } from '@/hooks/use-branch-scope'
import { useInventory } from '@/hooks/use-inventory'
import { usePermission } from '@/hooks/use-permission'
import { useTransfersList } from '@/hooks/use-transfers'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  inventoryHubHref,
  inventoryWorkspaceHref,
  parseInventoryHubSection,
  type InventoryHubSection,
} from '@/lib/inventory-hub'

type TabDef = {
  id: InventoryHubSection
  label: string
  icon: LucideIcon
  visible: boolean
}

const HUB_TITLE = 'Stock by variant & multi-location transfers'
const HUB_DESCRIPTION =
  'Real-time inventory synchronization across boutiques and warehouses. Balances update through verified transfers and are reconciled on a continuous cycle.'

/**
 * Stock hub: variant ledger, transfers, receiving, supplier receipts and replenishment.
 */
export function InventoryHubView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const scope = useBranchScope()
  const branchId = useEffectiveListBranchId('')
  const {
    can,
    canSeeTransfers,
    canReceiveTransfers,
    canManageMinimums,
    canRequestTransfer,
  } = usePermission()

  const stock = can('stock.view')
  const showTransfers = canSeeTransfers()
  const showReceiving = canReceiveTransfers()
  const showReceiveStock = can('stock.adjust')
  const showReplenishment = canManageMinimums()

  const tabs: TabDef[] = useMemo(
    () =>
      (
        [
          { id: 'variants', label: 'Variants stock', icon: Warehouse, visible: stock },
          { id: 'transfers', label: 'Transfers', icon: ArrowLeftRight, visible: showTransfers },
          { id: 'receiving', label: 'Receiving log', icon: PackageCheck, visible: showReceiving },
          { id: 'receive-stock', label: 'Receive stock', icon: PackagePlus, visible: showReceiveStock },
          { id: 'replenishment', label: 'Replenishment', icon: Truck, visible: showReplenishment },
        ] satisfies TabDef[]
      ).filter((t) => t.visible),
    [stock, showTransfers, showReceiving, showReceiveStock, showReplenishment],
  )

  const requested = parseInventoryHubSection(searchParams.get('section'))
  const filterFromUrl = searchParams.get('filter')
  const section: InventoryHubSection = useMemo(() => {
    if (requested && tabs.some((t) => t.id === requested)) return requested
    if (filterFromUrl && parseInventoryFilter(filterFromUrl) !== 'all' && tabs.some((t) => t.id === 'variants')) {
      return 'variants'
    }
    return tabs[0]?.id ?? 'variants'
  }, [requested, tabs, filterFromUrl])

  useEffect(() => {
    if (requested && tabs.some((t) => t.id === requested)) return
    if (!requested && section === 'variants' && !filterFromUrl) return
    const next = new URLSearchParams(searchParams.toString())
    next.set('section', section)
    const merged = next.toString()
    if (merged !== searchParams.toString()) router.replace(`/inventory?${merged}`, { scroll: false })
  }, [requested, tabs, section, router, searchParams, filterFromUrl])

  const variantCountQuery = useInventory({ scope, filter: 'all', search: '' })
  const transferCountQuery = useTransfersList(branchId, '', 0)

  function tabBadge(id: InventoryHubSection): string | null {
    if (id === 'variants' && variantCountQuery.data) {
      return formatNumber(variantCountQuery.data.length)
    }
    if (id === 'transfers' && transferCountQuery.data) {
      return formatNumber(transferCountQuery.data.total)
    }
    return null
  }

  return (
    <>
      <PageHeader
        eyebrow="Maison logistics / Inventory"
        title={HUB_TITLE}
        description={HUB_DESCRIPTION}
        actions={
          <div className="heading-actions inventory-hub-actions">
            {showReceiveStock ? (
              <Link href={inventoryWorkspaceHref('receive-stock')} className="btn btn-secondary">
                <PackagePlus size={16} aria-hidden="true" />
                Stock adjustment
              </Link>
            ) : null}
            {canRequestTransfer() ? (
              <Link href="/transfers/new" className="btn btn-primary">
                <Plus size={16} aria-hidden="true" />
                Prepare transfer
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="inventory-hub-tabs" role="tablist" aria-label="Inventory sections">
        {tabs.map(({ id, label, icon: Icon }) => {
          const href = inventoryHubHref(id)
          const selected = id === section
          const badge = tabBadge(id)
          return (
            <Link
              key={id}
              href={href}
              scroll={false}
              role="tab"
              aria-selected={selected}
              className={cn('inventory-hub-tab', selected && 'inventory-hub-tab--active')}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
              {badge ? <span className="inventory-hub-tab-badge tabular">{badge}</span> : null}
            </Link>
          )
        })}
      </div>

      <div className="inventory-hub-panel" role="tabpanel" id={`inventory-section-${section}`}>
        {section === 'variants' && <InventoryVariantsView showPageHeader={false} />}
        {section === 'transfers' && showTransfers && <TransfersView embedded />}
        {section === 'receiving' && showReceiving && <TransfersView embedded initialStatus="dispatched" />}
        {section === 'receive-stock' && showReceiveStock && <StockReceiptsView embedded />}
        {section === 'replenishment' && showReplenishment && <ReplenishmentView embedded />}
      </div>
    </>
  )
}
