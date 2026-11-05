'use client'

import { ArrowUp } from 'lucide-react'

/**
 * A column header that sorts.
 *
 * `aria-sort` goes on the `th`, which is what a screen reader announces with
 * the column name, and is repeated on the button so the arrow's CSS can key off
 * it without a second source of truth.
 */
export function SortableTh<K extends string>({
  columnKey,
  label,
  sort,
  numeric,
  className,
}: {
  columnKey: K
  label: string
  sort: { toggle: (key: K) => void; ariaSort: (key: K) => 'ascending' | 'descending' | 'none' }
  /** Right-aligns the cell and puts the arrow on the left of the label. */
  numeric?: boolean
  className?: string
}) {
  const current = sort.ariaSort(columnKey)
  const next = current === 'ascending' ? 'descending' : 'ascending'
  return (
    <th
      scope="col"
      aria-sort={current}
      className={[numeric ? 'num' : '', className ?? ''].filter(Boolean).join(' ')}
    >
      <button
        type="button"
        className="th-sort"
        aria-sort={current}
        title={`Sort by ${label}, ${next}`}
        onClick={() => sort.toggle(columnKey)}
      >
        <span>{label}</span>
        <ArrowUp size={12} className="th-sort-icon" aria-hidden="true" />
      </button>
    </th>
  )
}
