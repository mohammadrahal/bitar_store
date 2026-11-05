'use client'

import { useMemo, useState } from 'react'

export type SortDirection = 'asc' | 'desc'

export interface SortState<K extends string> {
  key: K
  direction: SortDirection
}

/** What a column sorts on. `null` always sorts last, whichever way the column points. */
export type SortAccessors<T, K extends string> = Record<K, (row: T) => string | number | null | undefined>

const collator = new Intl.Collator('en-US', { numeric: true, sensitivity: 'base' })

function compare(a: string | number | null | undefined, b: string | number | null | undefined): number {
  const aMissing = a === null || a === undefined || a === ''
  const bMissing = b === null || b === undefined || b === ''
  /* A row with nothing in the column sinks either way: "sort by minimum" should
     not fill the top of the list with variants that have no minimum. */
  if (aMissing || bMissing) return aMissing === bMissing ? 0 : aMissing ? 1 : -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return collator.compare(String(a), String(b))
}

/**
 * Sorts a page of rows that is already in memory.
 *
 * Every list this is used on is fetched whole and paged in the browser, so
 * sorting here sorts the entire result rather than just the visible page — the
 * figure at the top really is the largest, not the largest of twelve. A column
 * is re-sorted in place, so changing it never refetches.
 *
 * Clicking the active column flips its direction; a new column starts in the
 * direction given for it, because "biggest first" is the useful default for a
 * quantity and "A first" for a name.
 */
export function useSortedRows<T, K extends string>(
  rows: T[] | undefined,
  accessors: SortAccessors<T, K>,
  initial: SortState<K>,
  /** Columns that should open descending, such as quantities and money. */
  descendingFirst: readonly K[] = [],
) {
  const [sort, setSort] = useState<SortState<K>>(initial)

  const sorted = useMemo(() => {
    if (!rows) return rows
    const accessor = accessors[sort.key]
    if (!accessor) return rows
    const factor = sort.direction === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => compare(accessor(a), accessor(b)) * factor)
    /* `accessors` is rebuilt every render by every caller, so it is deliberately
       not a dependency: the key and direction are what change the result. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, sort.key, sort.direction])

  function toggle(key: K) {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: descendingFirst.includes(key) ? 'desc' : 'asc' },
    )
  }

  function ariaSort(key: K): 'ascending' | 'descending' | 'none' {
    if (sort.key !== key) return 'none'
    return sort.direction === 'asc' ? 'ascending' : 'descending'
  }

  return { rows: sorted, sort, toggle, ariaSort }
}
