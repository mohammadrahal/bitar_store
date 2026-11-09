'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'
import { motion } from 'motion/react'
import { staggerItem } from '@/components/motion/stagger'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { formatDelta, type Delta } from '@/lib/dashboard-range'
import { formatNumber } from '@/lib/format'

const DELTA_ICON = { up: ArrowUpRight, down: ArrowDownRight, flat: ArrowRight } as const

/**
 * The change against the preceding window. Direction is carried by the arrow
 * and the sign as well as the colour, so it survives both colour blindness and
 * a monochrome print; the tone says whether that direction is welcome, which is
 * not the same question as which way it points.
 */
function StatHeroStatus({
  label,
  tone = 'good',
  icon: StatusIcon,
}: {
  label: string
  tone?: 'good' | 'warn' | 'flat'
  icon?: LucideIcon
}) {
  return (
    <span className={`stat-hero-badge tone-${tone}`}>
      {StatusIcon ? <StatusIcon size={12} aria-hidden="true" /> : null}
      {label}
    </span>
  )
}

function StatDeltaBadge({
  delta,
  upIsGood,
}: {
  delta: Delta
  upIsGood: boolean
}) {
  const Icon = DELTA_ICON[delta.direction]
  const tone =
    delta.direction === 'flat' ? 'flat' : (delta.direction === 'up') === upIsGood ? 'good' : 'bad'
  return (
    <span className={`stat-hero-badge tone-${tone} tabular`}>
      <Icon size={12} aria-hidden="true" />
      {formatDelta(delta)}
    </span>
  )
}

function StatDelta({
  delta,
  since,
  upIsGood,
  simple,
}: {
  delta: Delta
  since: string
  upIsGood: boolean
  simple?: boolean
}) {
  const Icon = DELTA_ICON[delta.direction]
  const tone =
    delta.direction === 'flat' ? 'flat' : (delta.direction === 'up') === upIsGood ? 'good' : 'bad'
  if (simple) {
    return (
      <>
        <StatDeltaBadge delta={delta} upIsGood={upIsGood} />
        <p className="stat-foot stat-foot-split">
          <span className="stat-foot-since">{since}</span>
        </p>
      </>
    )
  }
  return (
    <span className={`stat-delta tone-${tone}`}>
      <Icon size={13} aria-hidden="true" />
      <span className="tabular">{formatDelta(delta)}</span>
      <span className="stat-delta-since">{since}</span>
    </span>
  )
}

/**
 * The same slot when there is nothing to compare against. a period before the
 * first sale, or a shop that opened inside the window. Grey and dashed rather
 * than a green "+100%", which would read as growth from nothing.
 */
function NoDelta({ since, simple }: { since: string; simple?: boolean }) {
  if (simple) {
    return (
      <p className="stat-foot stat-foot-split">
        <span className="stat-foot-since">No data {since}</span>
      </p>
    )
  }
  return (
    <span className="stat-delta tone-flat">
      <ArrowRight size={13} aria-hidden="true" />
      <span className="stat-foot-since">No data {since}</span>
    </span>
  )
}

function StatValueDisplay({
  value,
  animateValue,
  formatAnimated,
}: {
  value: string
  animateValue?: number
  formatAnimated?: (n: number) => string
}) {
  if (animateValue !== undefined && formatAnimated) {
    return <AnimatedNumber value={animateValue} format={formatAnimated} />
  }
  return value
}

export function StatCard({
  label,
  value,
  animateValue,
  formatAnimated,
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
  simple = false,
  heroStatus,
}: {
  label: string
  value: string
  /** When set with `formatAnimated`, the headline count animates on load and when data changes. */
  animateValue?: number
  formatAnimated?: (n: number) => string
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
   * pass it for figures a period can be measured over. a count of locations or
   * of empty variants is a fact about right now and has no trend.
   */
  delta?: Delta | null
  /** Names the period the delta is measured against, e.g. "vs previous 30 days". */
  deltaSince?: string
  /** False where a rise is the bad news, such as a stock-out count. */
  deltaUpIsGood?: boolean
  /** Dashboard KPIs: uppercase label, one footnote line. value and comparison only. */
  simple?: boolean
  /** Right-side pill on overview KPIs when there is no period delta (e.g. healthy stock). */
  heroStatus?: { label: string; tone?: 'good' | 'warn' | 'flat'; icon?: LucideIcon }
}) {
  const className = `stat-card ${highlight ? 'highlight' : ''} ${simple ? 'simple' : ''} ${alert && !simple ? 'tone-warn-value' : ''}`
  const comparable = Boolean(deltaSince)
  const trend =
    delta && deltaSince ? `${formatDelta(delta)} ${deltaSince}` : deltaSince ? `no data ${deltaSince}` : ''
  const spoken = [detail, trend].filter(Boolean).join('. ')
  const describedAs = `${label}, ${value}. ${aside ? `${aside}. ` : ''}${spoken}`
  const footnote =
    !simple && detail ? (
      <p className={`stat-foot ${alert ? 'detail-alert' : ''}`}>{detail}</p>
    ) : simple && detail && !comparable ? (
      <p className={`stat-foot stat-foot-split ${alert ? 'detail-alert' : ''}`}>
        <span>{detail}</span>
      </p>
    ) : null

  const body = simple ? (
    <>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        <span className={`stat-icon-wrap ${highlight ? 'tone-warn' : ''}`}>
          <Icon size={16} aria-hidden="true" />
        </span>
      </div>
      <div className="stat-hero">
        <strong className="stat-value tabular">
          <StatValueDisplay value={value} animateValue={animateValue} formatAnimated={formatAnimated} />
        </strong>
        {comparable && deltaSince ? (
          delta ? (
            <StatDeltaBadge delta={delta} upIsGood={deltaUpIsGood} />
          ) : (
            <span className="stat-hero-aside tabular">—</span>
          )
        ) : heroStatus ? (
          <StatHeroStatus
            label={heroStatus.label}
            tone={heroStatus.tone}
            icon={heroStatus.icon}
          />
        ) : aside ? (
          <span className="stat-hero-aside tabular">{aside}</span>
        ) : null}
      </div>
      {comparable && deltaSince ? (
        delta ? (
          <p className="stat-foot stat-foot-split">
            {detail ? <span className={alert ? 'detail-alert' : ''}>{detail}</span> : <span />}
            <span className="stat-foot-since">{deltaSince}</span>
          </p>
        ) : (
          <>
            <NoDelta since={deltaSince} simple />
            {detail ? (
              <p className={`stat-foot stat-foot-split ${alert ? 'detail-alert' : ''}`}>
                <span>{detail}</span>
              </p>
            ) : null}
          </>
        )
      ) : (
        footnote
      )}
    </>
  ) : (
    <>
      <div className="stat-top">
        <span>{label}</span>
        <Icon size={16} aria-hidden="true" />
      </div>
      <strong className="stat-value tabular">
        <StatValueDisplay value={value} animateValue={animateValue} formatAnimated={formatAnimated} />
      </strong>
      {aside ? <span className="stat-aside tabular">{aside}</span> : null}
      {detail ? <span className={`stat-detail ${alert ? 'detail-alert' : ''}`}>{detail}</span> : footnote}
      {comparable && deltaSince ? (
        delta ? (
          <StatDelta delta={delta} since={deltaSince} upIsGood={deltaUpIsGood} simple={simple} />
        ) : (
          <NoDelta since={deltaSince} simple={simple} />
        )
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
