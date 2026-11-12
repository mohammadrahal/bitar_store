'use client'

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-keys'
import { messageOf } from '@/lib/errors'
import { usePermission } from '@/hooks/use-permission'
import { effectiveCost, getProfitReport, getSkuCost, setSkuCost } from '@/services/costs.service'

/**
 * Cost and profit, over `/costs`.
 *
 * Both reads are **admin or manager by role**, so they are gated here rather
 * than left to answer 403: an employee's screen should not fire a request it
 * cannot be allowed to make, and a 403 in the devtools network tab reads like a
 * bug. `useCanViewCosts` is the gate, and the queries respect it themselves so
 * a caller cannot forget.
 *
 * Both services turn a 403 into `null` as a second line of defence, for the
 * case where a role is narrowed between the sign-in and the request.
 */
export function useCanViewCosts(): boolean {
  const { canViewCosts } = usePermission()
  return canViewCosts()
}

/** `GET /costs/skus/:id`: the typed catalog cost beside the warehouse average. */
export function useSkuCost(skuId: string | undefined, enabled = true) {
  const allowed = useCanViewCosts()
  return useQuery({
    queryKey: queryKeys.costs.sku(skuId ?? ''),
    queryFn: () => getSkuCost(skuId ?? ''),
    enabled: enabled && allowed && Boolean(skuId),
    staleTime: 60_000,
  })
}

/**
 * The unit cost of several SKUs at once, keyed by SKU id: the figure a supply
 * invoice is priced at. A SKU with no known cost is left out of the map, and
 * the map is empty for an account that may not see costs.
 *
 * Shares `useSkuCost`'s cache entries, so a cost already read is not re-read.
 */
export function useUnitCosts(skuIds: string[], enabled = true): Record<string, number> {
  const allowed = useCanViewCosts()
  return useQueries({
    queries: skuIds.map((skuId) => ({
      queryKey: queryKeys.costs.sku(skuId),
      queryFn: () => getSkuCost(skuId),
      enabled: enabled && allowed && Boolean(skuId),
      staleTime: 60_000,
    })),
    combine: (results) => {
      const costs: Record<string, number> = {}
      results.forEach((result, index) => {
        const cost = result.data ? effectiveCost(result.data) : null
        if (cost !== null && cost > 0) costs[skuIds[index]] = cost
      })
      return costs
    },
  })
}

/**
 * `PUT /costs/skus/:id`. `null` clears it.
 *
 * Invalidating the invoices matters: a supply invoice line priced `missing`
 * because no cost was known is repriced from this, so the draft the warehouse
 * is looking at changes the moment a cost is typed.
 */
export function useSetSkuCost() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ skuId, unitCost }: { skuId: string; unitCost: number | null }) =>
      setSkuCost(skuId, unitCost),
    onSuccess: async (cost) => {
      client.setQueryData(queryKeys.costs.sku(cost.skuId), cost)
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.costs.all }),
        client.invalidateQueries({ queryKey: queryKeys.apiInvoices.all }),
      ])
      toast.success(
        cost.catalogCost === null ? 'Cost cleared' : `Cost set to ${cost.catalogCost}`,
      )
    },
    onError: (error) => toast.error(messageOf(error) ?? 'Could not save the cost'),
  })
}

/**
 * `GET /costs/profit`. Needs `reports.financial` as well as the role.
 *
 * Pass an empty `branchId` for every branch the account reaches; the answer
 * carries `byBranch` either way.
 */
export function useProfitReport(
  query: { branchId?: string; from: string; to: string },
  enabled = true,
) {
  const { branchId = '', from, to } = query
  const allowed = useCanViewCosts()
  /* `reports.financial` is a *server* key, so it is read with `apiCan` and not
     `can` — the local grantable list has `reports.view_all` instead, and
     checking that one here would gate on the wrong thing. */
  const { apiCan } = usePermission()
  return useQuery({
    queryKey: queryKeys.costs.profit(branchId, from, to),
    queryFn: () => getProfitReport({ ...(branchId ? { branchId } : {}), from, to }),
    enabled: enabled && allowed && apiCan('reports.financial') && Boolean(from) && Boolean(to),
    staleTime: 60_000,
  })
}
