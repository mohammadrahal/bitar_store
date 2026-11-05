import { useEffect, useMemo, useState } from 'react'

export const DEFAULT_TABLE_PAGE_SIZE = 20

export function paginateSlice<T>(items: readonly T[], page: number, pageSize: number) {
  const total = items.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(Math.max(1, page), pageCount)
  const visible = items.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  return { visible, total, pageCount, currentPage }
}

/** Client-side table pagination; resets to page 1 when `resetKey` changes. */
export function usePagination<T>(items: readonly T[], pageSize = DEFAULT_TABLE_PAGE_SIZE, resetKey?: unknown) {
  const [page, setPage] = useState(1)

  useEffect(() => {
    setPage(1)
  }, [resetKey])

  const { visible, total, pageCount, currentPage } = useMemo(
    () => paginateSlice(items, page, pageSize),
    [items, page, pageSize],
  )

  return {
    page: currentPage,
    setPage,
    pageCount,
    total,
    pageSize,
    visible,
  }
}
