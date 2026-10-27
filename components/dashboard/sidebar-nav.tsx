'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { activeHref, flattenHrefs, useNavEntries } from '@/components/dashboard/nav-entries'
import { NavGroup } from '@/components/dashboard/nav-group'
import { useBranches } from '@/hooks/use-branches'
import { usePermission } from '@/hooks/use-permission'
import { initials } from '@/lib/format'
import { homePathFor, ROLE_LABELS } from '@/lib/permissions'

export function BrandLogo({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  const { user } = usePermission()
  return (
    <Link
      href={homePathFor(user)}
      className={`brand-logo ${compact ? 'compact' : ''}`}
      onClick={onNavigate}
      aria-label="Bitar Fashion"
    >
      {/* The artwork is applied as a CSS mask so it takes the ink token in either theme. */}
      <span className="logo-full" aria-hidden="true" />
      <span className="logo-mark" aria-hidden="true" />
    </Link>
  )
}

export function NavLinks({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname()
  const entries = useNavEntries()
  const current = activeHref(pathname, flattenHrefs(entries))

  const link = (href: string, label: string, Icon: LucideIcon) => {
    const active = href === current
    return (
      <Link
        key={href}
        href={href}
        className={`nav-item ${active ? 'active' : ''}`}
        aria-current={active ? 'page' : undefined}
        title={collapsed ? label : undefined}
        onClick={onNavigate}
      >
        <Icon size={18} aria-hidden="true" />
        {!collapsed && <span>{label}</span>}
      </Link>
    )
  }

  return (
    <nav className="nav-list" aria-label="Main">
      {entries.map((entry) => {
        if (entry.type === 'link') return link(entry.href, entry.label, entry.icon)
        if (collapsed) return entry.children.map((child) => link(child.href, child.label, child.icon))
        return (
          <NavGroup
            key={entry.label}
            entry={entry}
            current={current}
            groupActive={entry.children.some((child) => child.href === current)}
            onNavigate={onNavigate}
          />
        )
      })}
    </nav>
  )
}

export function SidebarFooter() {
  const { user, branchScoped } = usePermission()
  const { data: branches } = useBranches()
  const branchName = branchScoped
    ? (branches?.find((branch) => branch.id === user.branchId)?.name ?? (user.branchId ? 'Unknown branch' : 'No branch assigned'))
    : 'All locations'

  return (
    <div className="sidebar-bottom">
      <div className="user-row">
        <div className="avatar" aria-hidden="true">
          {initials(user.name)}
        </div>
        <div>
          <strong>{user.name}</strong>
          <small>
            {ROLE_LABELS[user.role]}
            {branchName ? ` · ${branchName}` : ''}
          </small>
        </div>
      </div>
    </div>
  )
}
