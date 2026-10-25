'use client'

import { Menu } from 'lucide-react'
import { SignOutButton } from '@/components/auth/sign-out-button'
import { BrandLogo } from '@/components/dashboard/sidebar-nav'
import { Can } from '@/components/shared/can'
import { RoleSwitcher } from '@/components/shared/role-switcher'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { useBranches } from '@/hooks/use-branches'
import { usePermission } from '@/hooks/use-permission'
import { useUIStore } from '@/store/ui-store'
import { ALL_BRANCHES } from '@/types'

function BranchFilter() {
  const { data: branches, isPending } = useBranches()
  const branchScope = useUIStore((state) => state.branchScope)
  const setBranchScope = useUIStore((state) => state.setBranchScope)

  return (
    <label className="branch-switcher">
      <span className="switcher-dot" aria-hidden="true" />
      <span className="sr-only">Branch filter</span>
      <select value={branchScope} onChange={(event) => setBranchScope(event.target.value)} disabled={isPending}>
        <option value={ALL_BRANCHES}>All branches</option>
        {branches?.map((branch) => (
          <option key={branch.id} value={branch.id}>
            {branch.name}
          </option>
        ))}
      </select>
    </label>
  )
}

function ScopedBranchLabel() {
  const { user } = usePermission()
  const { data: branches } = useBranches()
  const branch = branches?.find((candidate) => candidate.id === user.branchId)
  const label = branch?.name ?? (user.branchId ? 'Your branch' : 'No branch assigned')

  return (
    <span className="branch-switcher" aria-label={`Scoped to ${label}`}>
      <span className="switcher-dot" aria-hidden="true" />
      {label}
    </span>
  )
}

export function Topbar() {
  const setMobileNavOpen = useUIStore((state) => state.setMobileNavOpen)
  const mobileNavOpen = useUIStore((state) => state.mobileNavOpen)

  return (
    <header className="topbar">
      <div className="mobile-brand">
        <button
          type="button"
          className="icon-btn"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open menu"
          aria-expanded={mobileNavOpen}
        >
          <Menu size={20} />
        </button>
        <BrandLogo />
      </div>
      <div className="top-actions">
        <Can action="branches:view-all" fallback={<ScopedBranchLabel />}>
          <BranchFilter />
        </Can>
        <RoleSwitcher />
        <ThemeToggle />
        <SignOutButton />
      </div>
    </header>
  )
}
