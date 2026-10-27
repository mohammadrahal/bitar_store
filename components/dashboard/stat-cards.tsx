'use client'

import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, Boxes, Layers, Package, Store } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import type { InventoryStats } from '@/types'

export function StatCard({
  label,
  value,
  detail,
  alert,
  highlight,
  icon: Icon,
}: {
  label: string
  value: string
  detail: string
  alert?: boolean
  highlight?: boolean
  icon: LucideIcon
}) {
  return (
    <article className={`stat-card ${highlight ? 'highlight' : ''}`}>
      <div className="stat-top">
        <span>{label}</span>
        <Icon size={16} aria-hidden="true" />
      </div>
      <strong className="stat-value tabular">{value}</strong>
      <span className={`stat-detail ${alert ? 'detail-alert' : ''}`}>{detail}</span>
    </article>
  )
}

/** "1 warehouse", "2 branches", "0 variants". */
export function countOf(value: number, singular: string, plural = `${singular}s`) {
  return `${formatNumber(value)} ${value === 1 ? singular : plural}`
}

/** Network-wide figures: every location the viewer can see. */
export function NetworkStatCards({ stats }: { stats: InventoryStats }) {
  const branches = stats.branchCount - stats.warehouseCount
  return (
    <div className="stats-grid">
      <StatCard
        label="Locations"
        value={formatNumber(stats.branchCount)}
        detail={`${countOf(stats.warehouseCount, 'warehouse')} · ${countOf(branches, 'branch', 'branches')}`}
        icon={Store}
      />
      <StatCard
        label="Products"
        value={formatNumber(stats.productCount)}
        detail={`${countOf(stats.inStockVariantCount, 'variant')} in stock`}
        icon={Package}
      />
      <StatCard
        label="Stock units"
        value={formatNumber(stats.stockUnits)}
        detail="On hand across all locations"
        icon={Boxes}
      />
      <StatCard
        label="Low stock"
        value={formatNumber(stats.lowStockCount)}
        detail={
          stats.outOfStockCount > 0
            ? `${countOf(stats.outOfStockCount, 'variant')} out of stock`
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
        detail={`of ${countOf(stats.variantCount, 'variant')} in the catalog`}
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
