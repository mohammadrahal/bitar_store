'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-keys'
import { changeOwnPassword, updateOwnName } from '@/services/profile.service'
import { useUserStore } from '@/store/user-store'

/**
 * Neither mutation reports its error as a toast: a refusal belongs next to the
 * field it is about, so the forms render `error.message` themselves.
 */
export function useUpdateOwnName() {
  const queryClient = useQueryClient()
  const setUser = useUserStore((state) => state.setUser)

  return useMutation({
    mutationFn: (fullName: string) => updateOwnName(fullName),
    onSuccess: (user) => {
      setUser(user)
      /* The account also appears in the users list, where the name is shown. */
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all })
      toast.success('Profile updated')
    },
  })
}

export function useChangeOwnPassword() {
  return useMutation({
    mutationFn: (password: string) => changeOwnPassword(password),
    onSuccess: () => toast.success('Password changed'),
  })
}
