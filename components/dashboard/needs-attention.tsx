'use client'

import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { StaggerList, staggerItem } from '@/components/motion/stagger'
import { ErrorState } from '@/components/shared/error-state'
import { motion } from 'motion/react'
import { useAttention, type AttentionRow } from '@/hooks/use-attention'
import { formatNumber } from '@/lib/format'
import type { BranchScope } from '@/types'

function Row({ row }: { row: AttentionRow }) {
  const Icon = row.icon
  return (
    <motion.li className={`attention-row tone-${row.tone}`} variants={staggerItem}>
      <span className="attention-icon" aria-hidden="true">
        <Icon size={16} />
      </span>
      <span className="attention-count tabular">{formatNumber(row.count)}</span>
      <span className="attention-text">
        <strong>{row.label}</strong>
        {row.detail && <small>{row.detail}</small>}
      </span>
      <Link href={row.href} className="btn btn-secondary btn-sm attention-action">
        {row.action}
        <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </motion.li>
  )
}

function Skeleton() {
  return (
    <ul className="attention-list" aria-busy="true">
      {Array.from({ length: 2 }, (_, index) => (
        <li key={index} className="attention-row">
          <span className="skeleton attention-skeleton" aria-hidden="true" />
        </li>
      ))}
    </ul>
  )
}

/**
 * The first block on the overview: what is waiting for someone, with the way to
 * it. It leads the page because a manager opens the dashboard to find out what
 * needs doing, not to read yesterday's revenue — the KPIs below answer "how are
 * we doing", this answers "what do I do now".
 *
 * Rows at zero are hidden rather than greyed, so the length of the list is
 * itself the signal, and "All clear" is a positive statement rather than six
 * rows of nothing. Rows whose data this API cannot answer never reach here; see
 * `useAttention`.
 */
export function NeedsAttention({ scope }: { scope: BranchScope }) {
  const { rows, isPending, isError, error, refetch } = useAttention(scope, { detail: true })

  return (
    <section className="attention" aria-label="Needs attention">
      <div className="section-bar">
        <h2 className="section-title">Needs attention</h2>
      </div>

      {isPending ? (
        <Skeleton />
      ) : isError ? (
        <div className="attention-panel">
          <ErrorState title="Could not load what needs attention" error={error} onRetry={refetch} />
        </div>
      ) : rows.length === 0 ? (
        <p className="attention-clear">
          <span className="attention-clear-icon" aria-hidden="true">
            <Check size={16} />
          </span>
          All clear — nothing is waiting on you.
        </p>
      ) : (
        <StaggerList as="ul" className="attention-list">
          {rows.map((row) => (
            <Row key={row.key} row={row} />
          ))}
        </StaggerList>
      )}
    </section>
  )
}
