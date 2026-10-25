'use client'

import { UserCog } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useUsers } from '@/hooks/use-users'
import { ROLE_LABELS } from '@/lib/permissions'
import { bootstrapSession } from '@/services/session.service'
import { useCurrentUser, useUserStore } from '@/store/user-store'

/**
 * Development affordance: admins can jump between API users to test branch scope.
 */
export function RoleSwitcher() {
  const user = useCurrentUser()
  const signIn = useUserStore((state) => state.signIn)
  const queryClient = useQueryClient()
  const isAdmin = user.role === 'admin'
  const { data: apiUsers } = useUsers(isAdmin)

  if (!isAdmin) {
    return (
      <span className="branch-switcher" aria-label={`Signed in as ${user.name}, ${ROLE_LABELS[user.role]}`}>
        <UserCog size={16} aria-hidden="true" />
        {user.name} · {ROLE_LABELS[user.role]}
      </span>
    )
  }

  const options =
    apiUsers?.map((account) => ({ id: account.id, name: account.fullName, role: account.role })) ??
    [{ id: user.id, name: user.name, role: user.role }]

  return (
    <label className="select-inline" title="Switch the signed-in user (dev)">
      <UserCog size={16} aria-hidden="true" />
      <span className="sr-only">Signed in as</span>
      <select
        value={user.id}
        onChange={(event) => {
          const nextId = event.target.value
          if (nextId === user.id) return
          void bootstrapSession(nextId).then((session) => {
            queryClient.clear()
            signIn(session)
          })
        }}
      >
        {options.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name} · {ROLE_LABELS[account.role]}
          </option>
        ))}
      </select>
    </label>
  )
}
