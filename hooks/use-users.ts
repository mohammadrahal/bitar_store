'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-keys'
import type { UpdateUserInput } from '@/lib/api'
import {
  createUserWithBranch,
  deactivateUser,
  grantBranchAccess,
  listUsers,
  revokeBranchAccess,
  setUserActive,
  updateUser,
  updateUserWithBranch,
  type CreateUserWithBranchInput,
  type UpdateUserWithBranchInput,
} from '@/services/users.service'

export function useUsers(enabled = true) {
  return useQuery({
    queryKey: queryKeys.users.list(),
    queryFn: listUsers,
    enabled,
  })
}

function useUsersMutationCallbacks() {
  const queryClient = useQueryClient()
  return {
    invalidate: () => void queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
    reportError: (error: Error) => toast.error(error.message),
  }
}

export function useCreateUser() {
  const { invalidate, reportError } = useUsersMutationCallbacks()
  return useMutation({
    mutationFn: (input: CreateUserWithBranchInput) => createUserWithBranch(input),
    onSuccess: (user) => {
      invalidate()
      toast.success(`${user.fullName} added`)
    },
    onError: reportError,
  })
}

export function useUpdateUser() {
  const { invalidate, reportError } = useUsersMutationCallbacks()
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: UpdateUserInput }) => updateUser(id, changes),
    onSuccess: (user) => {
      invalidate()
      toast.success(`${user.fullName} updated`)
    },
    onError: reportError,
  })
}

export function useUpdateUserWithBranch() {
  const { invalidate, reportError } = useUsersMutationCallbacks()
  return useMutation({
    mutationFn: (input: UpdateUserWithBranchInput) => updateUserWithBranch(input),
    onSuccess: (user, input) => {
      invalidate()
      if (input.password?.trim()) {
        toast.success(`${user.fullName} updated — they can sign in with the new password`)
      } else {
        toast.success(`${user.fullName} updated`)
      }
    },
    onError: reportError,
  })
}

export function useSetUserActive() {
  const { invalidate, reportError } = useUsersMutationCallbacks()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; name: string; isActive: boolean }) => setUserActive(id, isActive),
    onSuccess: (user, { isActive }) => {
      invalidate()
      toast.success(isActive ? `${user.fullName} reactivated` : `${user.fullName} deactivated`)
    },
    onError: reportError,
  })
}

/** Deactivates only — there is no hard delete on the API. */
export function useDeactivateUser() {
  const { invalidate, reportError } = useUsersMutationCallbacks()
  return useMutation({
    mutationFn: ({ id }: { id: string; name: string }) => deactivateUser(id),
    onSuccess: (_user, { name }) => {
      invalidate()
      toast.warning(`${name} deactivated`)
    },
    onError: reportError,
  })
}

export function useGrantBranchAccess() {
  const { invalidate, reportError } = useUsersMutationCallbacks()
  return useMutation({
    mutationFn: ({ userId, branchId }: { userId: string; branchId: string }) => grantBranchAccess(userId, branchId),
    onSuccess: () => {
      invalidate()
      toast.success('Branch access granted')
    },
    onError: reportError,
  })
}

export function useRevokeBranchAccess() {
  const { invalidate, reportError } = useUsersMutationCallbacks()
  return useMutation({
    mutationFn: ({ userId, branchId }: { userId: string; branchId: string }) => revokeBranchAccess(userId, branchId),
    onSuccess: () => {
      invalidate()
      toast.success('Branch access removed')
    },
    onError: reportError,
  })
}
