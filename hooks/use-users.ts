'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-keys'
import {
  createUserWithBranch,
  deleteUser,
  listUsers,
  setUserActive,
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
    onError: (error: Error) => {
      /* Creation is several calls; refresh so a half-finished account still shows. */
      invalidate()
      reportError(error)
    },
  })
}

export function useUpdateUserWithBranch() {
  const { invalidate, reportError } = useUsersMutationCallbacks()
  return useMutation({
    mutationFn: (input: UpdateUserWithBranchInput) => updateUserWithBranch(input),
    onSuccess: (user, input) => {
      invalidate()
      toast.success(
        input.password ? `${user.fullName} updated — they can sign in with the new password` : `${user.fullName} updated`,
      )
    },
    onError: (error: Error) => {
      invalidate()
      reportError(error)
    },
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

export function useDeleteUser() {
  const { invalidate, reportError } = useUsersMutationCallbacks()
  return useMutation({
    mutationFn: ({ id }: { id: string; name: string }) => deleteUser(id),
    onSuccess: (_result, { name }) => {
      invalidate()
      toast.success(`${name} deleted`)
    },
    onError: reportError,
  })
}
