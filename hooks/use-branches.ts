'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { usePermission } from '@/hooks/use-permission'
import { ApiError } from '@/lib/api'
import { branchHref } from '@/lib/branch-slug'
import { queryKeys } from '@/lib/query-keys'
import type { UpdateBranchInput } from '@/lib/api'
import {
  createBranch,
  deactivateBranch,
  getBranch,
  listBranches,
  updateBranch,
  type BranchInput,
} from '@/services/branches.service'
import { ALL_BRANCHES, type BranchScope } from '@/types'

/** The branches the current user is allowed to see at all. */
export function useBranchAccessScope(): BranchScope {
  const { user, locationScoped } = usePermission()
  return locationScoped && user.branchId ? user.branchId : ALL_BRANCHES
}

export function useBranches() {
  const scope = useBranchAccessScope()
  return useQuery({
    queryKey: queryKeys.branches.list(scope),
    queryFn: () => listBranches(scope),
  })
}

/**
 * The readable href for a branch page, for callers that only hold an id. Falls
 * back to the id until the branch list has arrived.
 */
export function useBranchHref() {
  const { data: branches } = useBranches()
  return (branchId: string) => {
    const branch = branches?.find((candidate) => candidate.id === branchId)
    return branch ? branchHref(branch) : `/branches/${branchId}`
  }
}

/** `segment` is the code or the id in the URL. */
export function useBranch(segment: string) {
  return useQuery({
    queryKey: queryKeys.branches.detail(segment),
    queryFn: () => getBranch(segment),
    enabled: Boolean(segment),
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
    /* A duplicate code is shown on the field it is about, so it skips the
       toast; everything else is still reported. */
    onError: (error: Error) => {
      if (error instanceof ApiError && error.status === 409) return
      reportError(error)
    },
  })
}

export function useUpdateBranch() {
  const { invalidate, reportError } = useBranchMutationCallbacks()
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: UpdateBranchInput }) =>
      updateBranch(id, changes),
    onSuccess: (branch) => {
      invalidate()
      toast.success(`${branch.name} updated`)
    },
    onError: reportError,
  })
}

export function useDeactivateBranch() {
  const { invalidate, reportError } = useBranchMutationCallbacks()
  return useMutation({
    mutationFn: ({ id }: { id: string; name: string }) => deactivateBranch(id),
    onSuccess: (_result, { name }) => {
      invalidate()
      toast.success(`${name} marked inactive`)
    },
    onError: reportError,
  })
}

/** @deprecated Use useDeactivateBranch — branches are not hard-deleted. */
export const useDeleteBranch = useDeactivateBranch

