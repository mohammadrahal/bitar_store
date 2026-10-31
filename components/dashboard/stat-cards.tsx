'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, Boxes, Layers, Package, Store } from 'lucide-react'
import { motion } from 'motion/react'
import { StaggerList, staggerItem } from '@/components/motion/stagger'
import { usePermission } from '@/hooks/use-permission'
import { formatNumber } from '@/lib/format'
import { inventoryHref } from '@/lib/inventory-filters'
import type { InventoryStats } from '@/types'

export function StatCard({
  label,
  value,
  detail,
  alert,
  highlight,
  icon: Icon,
  href,
}: {
  label: string
  value: string
  detail: string
  alert?: boolean
  highlight?: boolean
  icon: LucideIcon
  /** When set, the whole card navigates to this route. */
  href?: string
}) {
  const className = `stat-card ${highlight ? 'highlight' : ''}`
  const body = (
    <>
      <div className="stat-top">
        <span>{label}</span>
        <Icon size={16} aria-hidden="true" />
      </div>
      <strong className="stat-value tabular">{value}</strong>
      <span className={`stat-detail ${alert ? 'detail-alert' : ''}`}>{detail}</span>
    </>
  )

  if (href) {
    return (
      <motion.div className="stat-card-host" variants={staggerItem}>
        <Link href={href} className={className} aria-label={`${label}, ${value}. ${detail}`}>
          {body}
        </Link>
      </motion.div>
    )
  }

  return (
    <motion.article className={className} variants={staggerItem}>
      {body}
    </motion.article>
  )
}

/** "1 warehouse", "2 branches", "0 variants". */
export function countOf(value: number, singular: string, plural = `${singular}s`) {
  return `${formatNumber(value)} ${value === 1 ? singular : plural}`
}

/** Network-wide figures: every location the viewer can see. */
export function NetworkStatCards({ stats }: { stats: InventoryStats }) {
  const { can } = usePermission()
  const branches = stats.branchCount - stats.warehouseCount
  return (
    <StaggerList className="stats-grid">
      <StatCard
        label="Locations"
        value={formatNumber(stats.branchCount)}
        detail={`${countOf(stats.warehouseCount, 'warehouse')} · ${countOf(branches, 'branch', 'branches')}`}
        icon={Store}
        href={can('locations.view_all') ? '/branches' : undefined}
      />
      <StatCard
        label="Products"
        value={formatNumber(stats.productCount)}
        detail={`${countOf(stats.inStockVariantCount, 'variant')} in stock`}
        icon={Package}
        href="/products"
      />
      <StatCard
        label="Stock units"
        value={formatNumber(stats.stockUnits)}
        detail="On hand across all locations"
        icon={Boxes}
        href={can('stock.view') ? inventoryHref() : undefined}
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
        href={can('stock.view') ? inventoryHref('low') : undefined}
      />
    </StaggerList>
  )
}

/** The same figures narrowed to a single branch. */
export function BranchStatCards({ stats }: { stats: InventoryStats }) {
  const { can } = usePermission()
  const stock = can('stock.view') ? inventoryHref() : undefined
  const low = can('stock.view') ? inventoryHref('low') : undefined
  return (
    <StaggerList className="stats-grid">
      <StatCard
        label="Stock units"
        value={formatNumber(stats.stockUnits)}
        detail="On hand at this branch"
        icon={Boxes}
        href={stock}
      />
      <StatCard
        label="Variants carried"
        value={formatNumber(stats.inStockVariantCount)}
        detail={`of ${countOf(stats.variantCount, 'variant')} in the catalog`}
        icon={Layers}
        href="/products"
      />
      <StatCard
        label="Low stock"
        value={formatNumber(stats.lowStockCount)}
        detail="At or below the threshold"
        alert={stats.lowStockCount > 0}
        icon={AlertTriangle}
        href={low}
      />
      <StatCard
        label="Out of stock"
        value={formatNumber(stats.outOfStockCount)}
        detail={stats.outOfStockCount > 0 ? 'Needs restocking' : 'All variants stocked'}
        alert={stats.outOfStockCount > 0}
        icon={Package}
        href={low}
      />
    </StaggerList>
  )
}
