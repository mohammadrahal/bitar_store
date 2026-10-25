'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { usePermission } from '@/hooks/use-permission'
import { queryKeys } from '@/lib/query-keys'
import { createBranch, getBranch, listBranches, type BranchInput } from '@/services/branches.service'
import { ALL_BRANCHES, type BranchScope } from '@/types'

/** The branches the current user is allowed to see at all. */
export function useBranchAccessScope(): BranchScope {
  const { user, branchScoped } = usePermission()
  return branchScoped && user.branchId ? user.branchId : ALL_BRANCHES
}

export function useBranches() {
  const scope = useBranchAccessScope()
  return useQuery({
    queryKey: queryKeys.branches.list(scope),
    queryFn: () => listBranches(scope),
  })
}

export function useBranch(branchId: string) {
  return useQuery({
    queryKey: queryKeys.branches.detail(branchId),
    queryFn: () => getBranch(branchId),
    enabled: Boolean(branchId),
  })
}

function useBranchMutationCallbacks() {
  const queryClient = useQueryClient()
  return {
    invalidate: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.branches.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
    },
    reportError: (error: Error) => toast.error(error.message),
  }
}

export function useCreateBranch() {
  const { invalidate, reportError } = useBranchMutationCallbacks()
  return useMutation({
    mutationFn: (input: BranchInput) => createBranch(input),
    onSuccess: (branch) => {
      invalidate()
      toast.success(`${branch.name} added`)
    },
    onError: reportError,
  })
}

