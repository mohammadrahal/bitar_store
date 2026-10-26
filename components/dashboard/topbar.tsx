'use client'

import { Menu } from 'lucide-react'
import { SignOutButton } from '@/components/auth/sign-out-button'
import { BrandLogo } from '@/components/dashboard/sidebar-nav'
import { Can } from '@/components/shared/can'
import { SelectInput } from '@/components/shared/select-input'
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
    <SelectInput
      variant="inline"
      className="max-w-[240px]"
      aria-label="Branch filter"
      value={branchScope}
      onValueChange={setBranchScope}
      disabled={isPending}
      icon={<span className="switcher-dot" aria-hidden="true" />}
      options={[
        { value: ALL_BRANCHES, label: 'All branches' },
        ...(branches?.map((branch) => ({ value: branch.id, label: branch.name })) ?? []),
      ]}
    />
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
        <ThemeToggle />
        <SignOutButton />
      </div>
    </header>
  )
}
