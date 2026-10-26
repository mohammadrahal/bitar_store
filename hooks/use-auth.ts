'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { login, logout, type LoginInput } from '@/services/auth.service'
import { useUIStore } from '@/store/ui-store'
import { useUserStore } from '@/store/user-store'
import { ALL_BRANCHES } from '@/types'

/**
 * The error is surfaced inline by the form rather than as a toast, so the
 * message sits next to the fields it is about.
 */
export function useLogin() {
  const queryClient = useQueryClient()
  const signIn = useUserStore((state) => state.signIn)

  return useMutation({
    mutationFn: (input: LoginInput) => login(input),
    onSuccess: ({ token, user }) => {
      queryClient.clear()
      signIn(token, user)
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`)
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  const signOut = useUserStore((state) => state.signOut)
  const setBranchScope = useUIStore((state) => state.setBranchScope)

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // Clear the branch filter and caches first: signing out unmounts the app.
      setBranchScope(ALL_BRANCHES)
      queryClient.clear()
      signOut()
      toast.success('Signed out')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}
