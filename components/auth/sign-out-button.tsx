'use client'

import { LogOut } from 'lucide-react'
import { useLogout } from '@/hooks/use-auth'

export function SignOutButton() {
  const logout = useLogout()

  return (
    <button
      type="button"
      className="icon-btn"
      onClick={() => logout.mutate()}
      disabled={logout.isPending}
      aria-label="Sign out"
      title="Sign out"
    >
      <LogOut size={18} />
    </button>
  )
}
