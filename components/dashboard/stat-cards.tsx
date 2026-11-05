'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'
import { motion } from 'motion/react'
import { staggerItem } from '@/components/motion/stagger'
import { formatDelta, type Delta } from '@/lib/dashboard-range'
import { formatNumber } from '@/lib/format'

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

/**
 * The same slot when there is nothing to compare against — a period before the
 * first sale, or a shop that opened inside the window. Grey and dashed rather
 * than a green "+100%", which would read as growth from nothing.
 */
function NoDelta({ since }: { since: string }) {
  return (
    <span className="stat-delta tone-flat">
      <ArrowRight size={13} aria-hidden="true" />
      <span className="tabular">—</span>
      <span className="stat-delta-since">no data {since}</span>
    </span>
  )
}

export function StatCard({
  label,
  value,
  detail,
  aside,
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
  detail?: string
  /**
   * A second figure belonging to the headline one, such as "$80.00 today" under
   * the period's revenue. Sits above the trend line, not instead of it.
   */
  aside?: string
  alert?: boolean
  highlight?: boolean
  icon: LucideIcon
  /** When set, the whole card navigates to this route. */
  href?: string
  /** Opens a panel instead of navigating. Wins over `href`. */
  onClick?: () => void
  /**
   * Change against the preceding window; `null` when there is no baseline. Only
   * pass it for figures a period can be measured over — a count of locations or
   * of empty variants is a fact about right now and has no trend.
   */
  delta?: Delta | null
  /** Names the period the delta is measured against, e.g. "vs previous 30 days". */
  deltaSince?: string
  /** False where a rise is the bad news, such as a stock-out count. */
  deltaUpIsGood?: boolean
}) {
  const className = `stat-card ${highlight ? 'highlight' : ''}`
  const comparable = Boolean(deltaSince)
  const spoken = delta && deltaSince ? `${formatDelta(delta)} ${deltaSince}` : (detail ?? '')
  const describedAs = `${label}, ${value}. ${aside ? `${aside}. ` : ''}${spoken}`
  const body = (
    <>
      <div className="stat-top">
        <span>{label}</span>
        <Icon size={16} aria-hidden="true" />
      </div>
      <strong className="stat-value tabular">{value}</strong>
      {aside && <span className="stat-aside tabular">{aside}</span>}
      {comparable && deltaSince ? (
        delta ? (
          <StatDelta delta={delta} since={deltaSince} upIsGood={deltaUpIsGood} />
        ) : (
          <NoDelta since={deltaSince} />
        )
      ) : detail ? (
        <span className={`stat-detail ${alert ? 'detail-alert' : ''}`}>{detail}</span>
      ) : null}
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
