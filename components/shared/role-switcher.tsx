'use client'

import { UserCog } from 'lucide-react'
import { ROLE_LABELS } from '@/lib/permissions'
import { useCurrentUser } from '@/store/user-store'

/**
 * Who is signed in. Switching users means signing in as them: a bearer token
 * belongs to one account, so there is no impersonation.
 */
export function RoleSwitcher() {
  const user = useCurrentUser()

  return (
    <span className="branch-switcher" aria-label={`Signed in as ${user.name}, ${ROLE_LABELS[user.role]}`}>
      <UserCog size={16} aria-hidden="true" />
      {user.name} · {ROLE_LABELS[user.role]}
    </span>
  )
}
