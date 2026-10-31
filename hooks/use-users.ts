'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-keys'
import {
  createUser,
  getUserGrants,
  getUserLocations,
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
    invalidate: () => void queryClient.invalidateQueries({ queryKey: queryKeys.users.all }),
    reportError: (error: Error) => toast.error(error.message),
  }
}

export function useCreateUser() {
  const { invalidate, reportError } = useUsersMutationCallbacks()
  return useMutation({
    mutationFn: (input: SaveUserInput) => createUser(input),
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

export function useUpdateUser() {
  const { invalidate, reportError } = useUsersMutationCallbacks()
  return useMutation({
    mutationFn: ({ id, ...input }: SaveUserInput & { id: string }) => updateUser(id, input),
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

/** Locations and keys for one account, as remembered in this browser. */
export function useUserAccess(userId: string) {
  return useQuery({
    queryKey: queryKeys.users.access(userId),
    queryFn: () => ({ locations: getUserLocations(userId), grants: getUserGrants(userId) }),
    enabled: Boolean(userId),
  })
}

export function useSaveUserGrants() {
  const { invalidate, reportError } = useUsersMutationCallbacks()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, grants }: { userId: string; name: string; grants: Record<string, string[]> }) =>
      saveUserGrants(userId, grants),
    onSuccess: (_result, { userId, name }) => {
      invalidate()
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.access(userId) })
      toast.success(`Permissions saved for ${name}`)
    },
    onError: reportError,
  })
}
