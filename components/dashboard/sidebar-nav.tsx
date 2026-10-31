'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserCog, type LucideIcon } from 'lucide-react'
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
      {/* Masked PNG wordmark, filled with the brass gold gradient. */}
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

/** The account row is the way into the profile screen. */
export function SidebarFooter({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  const { user, locationScoped } = usePermission()
  const { data: branches } = useBranches()
  const pathname = usePathname()
  const active = pathname === '/profile'
  const branchName = locationScoped
    ? (branches?.find((branch) => branch.id === user.branchId)?.name ?? (user.branchId ? 'Unknown branch' : 'No branch assigned'))
    : 'All locations'

  return (
    <div className="sidebar-bottom">
      <Link
        href="/profile"
        className={`user-row ${compact ? 'compact' : ''} ${active ? 'active' : ''}`}
        aria-current={active ? 'page' : undefined}
        title={compact ? `${user.name} — your profile` : 'Your profile'}
        onClick={onNavigate}
      >
        <div className="avatar" aria-hidden="true">
          {initials(user.name)}
        </div>
        <div className="user-row-text">
          <strong>{user.name}</strong>
          <small>
            {ROLE_LABELS[user.role]}
            {branchName ? ` · ${branchName}` : ''}
          </small>
        </div>
        <UserCog size={16} className="user-row-icon" aria-hidden="true" />
      </Link>
    </div>
  )
}
