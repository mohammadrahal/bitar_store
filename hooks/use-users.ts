'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { isApiFeatureMissing } from '@/lib/api/capabilities'
import { queryKeys } from '@/lib/query-keys'
import {
  createUser,
  deleteUserAccount,
  getBranchAccess,
  loadUserAccess,
  listUsers,
  saveUserGrants,
  setUserActive,
  updateUser,
  type SaveUserInput,
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
    /** Refreshes the employee table only — not every `branch-access` query. */
    invalidateList: () => void queryClient.invalidateQueries({ queryKey: queryKeys.users.list() }),
    reportError: (error: Error) => toast.error(error.message),
  }
}

export function useCreateUser() {
  const { invalidateList, reportError } = useUsersMutationCallbacks()
  return useMutation({
    mutationFn: (input: SaveUserInput) => createUser(input),
    onSuccess: (user) => {
      invalidateList()
      toast.success(`${user.fullName} added`)
    },
    onError: (error: Error) => {
      /* Creation is several calls; refresh so a half-finished account still shows. */
      invalidateList()
      reportError(error)
    },
  })
}

export function useUpdateUser() {
  const { invalidateList, reportError } = useUsersMutationCallbacks()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: SaveUserInput & { id: string }) => updateUser(id, input),
    onSuccess: (user, input) => {
      invalidateList()
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.branchAccess(input.id) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.permissions(input.id) })
      toast.success(
        input.password ? `${user.fullName} updated — they can sign in with the new password` : `${user.fullName} updated`,
      )
    },
    onError: (error: Error) => {
      invalidateList()
      reportError(error)
    },
  })
}

export function useDeleteUser() {
  const { invalidateList, reportError } = useUsersMutationCallbacks()
  return useMutation({
    mutationFn: (id: string) => deleteUserAccount(id),
    onSuccess: () => {
      invalidateList()
      toast.success('Account deleted. Their sales keep their name.')
    },
    onError: reportError,
  })
}

export function useSetUserActive() {
  const { invalidateList, reportError } = useUsersMutationCallbacks()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; name: string; isActive: boolean }) => setUserActive(id, isActive),
    onSuccess: (user, { isActive }) => {
      invalidateList()
      toast.success(isActive ? `${user.fullName} reactivated` : `${user.fullName} deactivated`)
    },
    onError: reportError,
  })
}

/** `GET /users/:id/branch-access` — admin only. `all` or the branches granted one by one. */
export function useBranchAccess(userId: string) {
  return useQuery({
    queryKey: queryKeys.users.branchAccess(userId),
    queryFn: () => getBranchAccess(userId),
    enabled: Boolean(userId) && !isApiFeatureMissing('branchAccess'),
    staleTime: 5 * 60_000,
  })
}

/** Branch access from the API; extra permission keys are stored on this device until the permissions UI uses the server. */
export function useUserAccess(userId: string) {
  return useQuery({
    queryKey: queryKeys.users.access(userId),
    queryFn: () => loadUserAccess(userId),
    enabled: Boolean(userId),
  })
}

export function useSaveUserGrants() {
  const { invalidateList, reportError } = useUsersMutationCallbacks()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, grants }: { userId: string; name: string; grants: Record<string, string[]> }) =>
      saveUserGrants(userId, grants),
    onSuccess: (_result, { userId, name }) => {
      invalidateList()
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.access(userId) })
      toast.success(`Permissions saved for ${name}`)
    },
    onError: reportError,
  })
}
