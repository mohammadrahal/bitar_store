'use client'

import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { isApiFeatureMissing } from '@/lib/api/capabilities'
import { salesQueryKeys } from '@/lib/query-keys'
import { getSalesHistory } from '@/services/sales.service'

const HISTORY_PAGE = 25

export interface SalesHistoryQuery {
  branchId: string
  from: string
  to: string
  offset: number
  search: string
}

/** Paginated completed till sales from `GET /sales/history` (not wholesale invoices). */
export function useSalesHistory(query: SalesHistoryQuery, { enabled = true }: { enabled?: boolean } = {}) {
  const { branchId, from, to, offset, search } = query
  return useQuery({
    queryKey: salesQueryKeys.history(branchId, from, to, offset, search),
    queryFn: async () => {
      const term = search.trim().toLowerCase()
      const result = await getSalesHistory({
        branchId: branchId || undefined,
        from,
        to,
        limit: term ? 200 : HISTORY_PAGE,
        offset: term ? 0 : offset,
      })
      if (!term) return result
      const filtered = result.sales.filter((row) => {
        const haystack = [row.reference, row.branch.name, row.soldBy.name ?? '', row.businessDate].join(' ').toLowerCase()
        return haystack.includes(term)
      })
      const start = offset
      return {
        ...result,
        sales: filtered.slice(start, start + HISTORY_PAGE),
        total: filtered.length,
      }
    },
    enabled: enabled && !isApiFeatureMissing('salesHistory') && Boolean(from) && Boolean(to),
    staleTime: 60_000,
  })
}

/** Appends pages of `GET /sales/history`. `X-Total-Count` decides whether another page exists. */
export function useSalesHistoryPages(query: { branchId: string; from: string; to: string }, enabled = true) {
  const { branchId, from, to } = query
  return useInfiniteQuery({
    queryKey: ['sales', 'history-pages', branchId, from, to] as const,
    queryFn: ({ pageParam }) =>
      getSalesHistory({
        branchId: branchId || undefined,
        from,
        to,
        limit: HISTORY_PAGE,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _pages, lastOffset) => {
      if (lastPage.sales.length === 0) return undefined
      const next = lastOffset + lastPage.sales.length
      return next < lastPage.total ? next : undefined
    },
    enabled: enabled && !isApiFeatureMissing('salesHistory') && Boolean(from) && Boolean(to),
    staleTime: 60_000,
  })
}

export { HISTORY_PAGE as salesHistoryPageSize }
