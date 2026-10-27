'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useMirroredBranches } from '@/hooks/use-stock'
import { queryKeys } from '@/lib/query-keys'
import {
  applyCount,
  getCountSheet,
  listCountReports,
  reportCount,
  resolveCountReport,
  type CountInput,
  type CountReportInput,
} from '@/services/counts.service'
import { disposeStock, listHolds, placeHold, releaseHold, type DisposalInput, type HoldInput } from '@/services/holds.service'
import { listReplenishment } from '@/services/replenishment.service'
import type { BranchScope } from '@/types'

export function useHolds(scope: BranchScope) {
  const mirrored = useMirroredBranches()
  return useQuery({ queryKey: queryKeys.stock.holds(scope), queryFn: () => listHolds(scope), enabled: mirrored !== null })
}

export function useCountSheet(branchId: string) {
  const mirrored = useMirroredBranches()
  return useQuery({
    queryKey: queryKeys.stock.countSheet(branchId),
    queryFn: () => getCountSheet(branchId),
    enabled: mirrored !== null && Boolean(branchId),
  })
}

export function useCountReports(scope: BranchScope) {
  const mirrored = useMirroredBranches()
  return useQuery({
    queryKey: queryKeys.stock.countReports(scope),
    queryFn: () => listCountReports(scope),
    enabled: mirrored !== null,
  })
}

export function useReplenishment(scope: BranchScope) {
  const mirrored = useMirroredBranches()
  return useQuery({
    queryKey: queryKeys.stock.replenishment(scope),
    queryFn: () => listReplenishment(scope),
    enabled: mirrored !== null,
  })
}

function useStockMutation<TInput, TResult>(run: (input: TInput) => Promise<TResult>, success: (result: TResult) => string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
      toast.success(success(result))
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function usePlaceHold() {
  return useStockMutation(
    ({ input, key }: { input: HoldInput; key: string }) => placeHold(input, key),
    (hold) => `${hold.quantity} of ${hold.sku} on hold at ${hold.branchName}`,
  )
}

export function useReleaseHold() {
  return useStockMutation(
    ({ id, key }: { id: string; key: string }) => releaseHold(id, key),
    (hold) => `${hold.quantity} of ${hold.sku} back in available stock`,
  )
}

export function useDispose() {
  return useStockMutation(
    ({ input, key }: { input: DisposalInput; key: string }) => disposeStock(input, key),
    (number) => `Disposal recorded as ${number}`,
  )
}

export function useApplyCount() {
  return useStockMutation(
    ({ input, key }: { input: CountInput; key: string }) => applyCount(input, key),
    (numbers) => `Count applied: ${numbers.join(', ')}`,
  )
}

export function useReportCount() {
  return useStockMutation(
    ({ input, key }: { input: CountReportInput; key: string }) => reportCount(input, key),
    () => 'Difference reported to a manager',
  )
}

export function useResolveCountReport() {
  return useStockMutation(
    ({ id, apply, key }: { id: string; apply: boolean; key: string }) => resolveCountReport(id, apply, key),
    (report) => (report.status === 'applied' ? 'Correction applied' : 'Report dismissed'),
  )
}
