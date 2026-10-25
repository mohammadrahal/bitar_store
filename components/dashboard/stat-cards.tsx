'use client'

import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, Boxes, Layers, Package, Store } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import type { InventoryStats } from '@/types'

function StatCard({
  label,
  value,
  detail,
  alert,
  icon: Icon,
}: {
  label: string
  value: string
  detail: string
  alert?: boolean
  icon: LucideIcon
}) {
  return (
    <article className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <Icon size={16} aria-hidden="true" />
      </div>
      <strong className="stat-value tabular">{value}</strong>
      <span className={`stat-detail ${alert ? 'detail-alert' : ''}`}>{detail}</span>
    </article>
  )
}

/** Network-wide figures: every branch the viewer can see. */
export function NetworkStatCards({ stats }: { stats: InventoryStats }) {
  return (
    <div className="stats-grid">
      <StatCard
        label="Branches"
        value={formatNumber(stats.branchCount)}
        detail={`${formatNumber(stats.variantCount)} variants tracked`}
        icon={Store}
      />
      <StatCard
        label="Products"
        value={formatNumber(stats.productCount)}
        detail={`${formatNumber(stats.inStockVariantCount)} variants in stock`}
        icon={Package}
      />
      <StatCard
        label="Stock units"
        value={formatNumber(stats.stockUnits)}
        detail="On hand across the scope"
        icon={Boxes}
      />
      <StatCard
        label="Low stock"
        value={formatNumber(stats.lowStockCount)}
        detail={
          stats.outOfStockCount > 0
            ? `${formatNumber(stats.outOfStockCount)} out of stock`
            : 'Nothing out of stock'
        }
        alert={stats.lowStockCount > 0 || stats.outOfStockCount > 0}
        icon={AlertTriangle}
      />
    </div>
  )
}

/** The same figures narrowed to a single branch. */
export function BranchStatCards({ stats }: { stats: InventoryStats }) {
  return (
    <div className="stats-grid">
      <StatCard
        label="Stock units"
        value={formatNumber(stats.stockUnits)}
        detail="On hand at this branch"
        icon={Boxes}
      />
      <StatCard
        label="Variants carried"
        value={formatNumber(stats.inStockVariantCount)}
        detail={`of ${formatNumber(stats.variantCount)} in the catalog`}
        icon={Layers}
      />
      <StatCard
        label="Low stock"
        value={formatNumber(stats.lowStockCount)}
        detail="At or below the threshold"
        alert={stats.lowStockCount > 0}
        icon={AlertTriangle}
      />
      <StatCard
        label="Out of stock"
        value={formatNumber(stats.outOfStockCount)}
        detail={stats.outOfStockCount > 0 ? 'Needs restocking' : 'All variants stocked'}
        alert={stats.outOfStockCount > 0}
        icon={Package}
      />
    </div>
  )
}
