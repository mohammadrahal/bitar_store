'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowRight, ArrowUpRight, Boxes, Layers, Package, Store } from 'lucide-react'
import { motion } from 'motion/react'
import { StaggerList, staggerItem } from '@/components/motion/stagger'
import { usePermission } from '@/hooks/use-permission'
import { formatDelta, type Delta } from '@/lib/dashboard-range'
import { formatNumber } from '@/lib/format'
import { inventoryHref } from '@/lib/inventory-filters'
import type { InventoryStats } from '@/types'

const DELTA_ICON = { up: ArrowUpRight, down: ArrowDownRight, flat: ArrowRight } as const

/**
 * The change against the preceding window. Direction is carried by the arrow
 * and the sign as well as the colour, so it survives both colour blindness and
 * a monochrome print; the tone says whether that direction is welcome, which is
 * not the same question as which way it points.
 */
function StatDelta({ delta, since, upIsGood }: { delta: Delta; since: string; upIsGood: boolean }) {
  const Icon = DELTA_ICON[delta.direction]
  const tone =
    delta.direction === 'flat' ? 'flat' : (delta.direction === 'up') === upIsGood ? 'good' : 'bad'
  return (
    <span className={`stat-delta tone-${tone}`}>
      <Icon size={13} aria-hidden="true" />
      <span className="tabular">{formatDelta(delta)}</span>
      <span className="stat-delta-since">{since}</span>
    </span>
  )
}

export function StatCard({
  label,
  value,
  detail,
  alert,
  highlight,
  icon: Icon,
  href,
  onClick,
  delta,
  deltaSince,
  deltaUpIsGood = true,
}: {
  label: string
  value: string
  detail: string
  alert?: boolean
  highlight?: boolean
  icon: LucideIcon
  /** When set, the whole card navigates to this route. */
  href?: string
  /** Opens a panel instead of navigating. Wins over `href`. */
  onClick?: () => void
  /** Change against the preceding window; `null` when there is no baseline. */
  delta?: Delta | null
  /** Names the period the delta is measured against, e.g. "vs prev 30 days". */
  deltaSince?: string
  /** False where a rise is the bad news, such as a stock-out count. */
  deltaUpIsGood?: boolean
}) {
  const className = `stat-card ${highlight ? 'highlight' : ''}`
  const showDelta = delta && deltaSince
  const spoken = showDelta ? `${formatDelta(delta)} ${deltaSince}` : detail
  const describedAs = `${label}, ${value}. ${spoken}`
  const body = (
    <>
      <div className="stat-top">
        <span>{label}</span>
        <Icon size={16} aria-hidden="true" />
      </div>
      <strong className="stat-value tabular">{value}</strong>
      {showDelta ? (
        <StatDelta delta={delta} since={deltaSince} upIsGood={deltaUpIsGood} />
      ) : (
        <span className={`stat-detail ${alert ? 'detail-alert' : ''}`}>{detail}</span>
      )}
    </>
  )

  if (onClick) {
    return (
      <motion.div className="stat-card-host" variants={staggerItem}>
        <button type="button" className={className} onClick={onClick} aria-label={describedAs}>
          {body}
        </button>
      </motion.div>
    )
  }

  if (href) {
    return (
      <motion.div className="stat-card-host" variants={staggerItem}>
        <Link href={href} className={className} aria-label={describedAs}>
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

/**
 * Network-wide figures: every location the viewer can see. `leading` takes
 * today's takings, so the row reads money first and still fills to four.
 */
export function NetworkStatCards({ stats, leading }: { stats: InventoryStats; leading?: React.ReactNode }) {
  const { can } = usePermission()
  const branches = stats.branchCount - stats.warehouseCount
  return (
    <StaggerList className="stats-grid">
      {leading}
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
    </StaggerList>
  )
}

/** The same figures narrowed to a single branch. */
export function BranchStatCards({ stats, leading }: { stats: InventoryStats; leading?: React.ReactNode }) {
  const { can } = usePermission()
  const stock = can('stock.view') ? inventoryHref() : undefined
  const empty = can('stock.view') ? inventoryHref('out') : undefined
  return (
    <StaggerList className="stats-grid">
      {leading}
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
        label="Out of stock here"
        value={formatNumber(Math.max(0, stats.variantCount - stats.inStockVariantCount))}
        detail="Carried variants with nothing on hand"
        alert={stats.variantCount > stats.inStockVariantCount}
        icon={Boxes}
        href={empty}
      />
    </StaggerList>
  )
}
