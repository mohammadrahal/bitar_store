'use client'

import { useQuery } from '@tanstack/react-query'
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
    enabled: enabled && Boolean(from) && Boolean(to),
    staleTime: 60_000,
  })
}

export { HISTORY_PAGE as salesHistoryPageSize }
