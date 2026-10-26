'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Building2,
  ChevronDown,
  LayoutDashboard,
  Package,
  ReceiptText,
  ShoppingBag,
  Store,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useBranches } from '@/hooks/use-branches'
import { usePermission } from '@/hooks/use-permission'
import { initials } from '@/lib/format'
import { homePathFor, ROLE_LABELS } from '@/lib/permissions'

interface NavLinkItem {
  type: 'link'
  href: string
  label: string
  icon: LucideIcon
}

interface NavGroupItem {
  type: 'group'
  label: string
  icon: LucideIcon
  children: { href: string; label: string; icon: LucideIcon }[]
}

type NavEntry = NavLinkItem | NavGroupItem

function flattenHrefs(entries: NavEntry[]): string[] {
  return entries.flatMap((entry) => (entry.type === 'link' ? [entry.href] : entry.children.map((child) => child.href)))
}

/** Navigation is derived from permissions, so a role never sees a link it cannot open. */
function useNavEntries(): NavEntry[] {
  const { user, can, branchScoped } = usePermission()
  const items: NavEntry[] = []

  if (can('branches:view-all')) items.push({ type: 'link', href: '/dashboard', label: 'Overview', icon: LayoutDashboard })
  if (branchScoped && user.branchId)
    items.push({ type: 'link', href: `/branches/${user.branchId}`, label: 'My branch', icon: Store })
  if (can('products:read')) items.push({ type: 'link', href: '/products', label: 'Products', icon: Package })

  const salesChildren: NavGroupItem['children'] = []
  if (can('sales:b2b:read')) salesChildren.push({ href: '/sales/b2b', label: 'B2B', icon: Building2 })
  if (can('sales:b2c:read')) salesChildren.push({ href: '/sales/b2c', label: 'B2C', icon: ShoppingBag })
  if (salesChildren.length) items.push({ type: 'group', label: 'Sales', icon: TrendingUp, children: salesChildren })

  if (can('invoices:read')) items.push({ type: 'link', href: '/invoices', label: 'Invoices', icon: ReceiptText })
  if (can('users:manage')) items.push({ type: 'link', href: '/users', label: 'Users', icon: Users })
  if (can('branches:manage')) items.push({ type: 'link', href: '/branches', label: 'Branches', icon: Store })

  return items
}

/** The most specific matching link wins, so /branches/:id never lights up two items. */
function activeHref(pathname: string, hrefs: string[]) {
  return (
    hrefs
      .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
      .sort((a, b) => b.length - a.length)[0] ?? null
  )
}

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
  const hrefs = flattenHrefs(entries)
  const current = activeHref(pathname, hrefs)

  return (
    <nav className="nav-list" aria-label="Main">
      {entries.map((entry) => {
        if (entry.type === 'link') {
          const { href, label, icon: Icon } = entry
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

        const groupActive = entry.children.some((child) => child.href === current)

        if (collapsed) {
          return entry.children.map(({ href, label, icon: Icon }) => {
            const active = href === current
            return (
              <Link
                key={href}
                href={href}
                className={`nav-item ${active ? 'active' : ''}`}
                aria-current={active ? 'page' : undefined}
                title={label}
                onClick={onNavigate}
              >
                <Icon size={18} aria-hidden="true" />
              </Link>
            )
          })
        }

        return (
          <NavGroup
            key={entry.label}
            entry={entry}
            current={current}
            groupActive={groupActive}
            onNavigate={onNavigate}
          />
        )
      })}
    </nav>
  )
}

/**
 * A nav section that opens and closes, so Sales keeps its children out of the
 * way until they are wanted. Collapsed sidebars never get here — they flatten
 * the children into plain icons above.
 */
function NavGroup({
  entry,
  current,
  groupActive,
  onNavigate,
}: {
  entry: NavGroupItem
  current: string | null
  groupActive: boolean
  onNavigate?: () => void
}) {
  const [open, setOpen] = useState(groupActive)
  const panelId = `nav-group-${entry.label.toLowerCase()}`

  /* Navigating into the group opens it, so the active child is never hidden. */
  useEffect(() => {
    if (groupActive) setOpen(true)
  }, [groupActive])

  return (
    <div className={`nav-group ${groupActive ? 'active' : ''} ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="nav-item nav-group-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <entry.icon size={18} aria-hidden="true" />
        <span>{entry.label}</span>
        <ChevronDown size={16} className="nav-group-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div className="nav-sublist" id={panelId} role="list">
          {entry.children.map(({ href, label, icon: Icon }) => {
            const active = href === current
            return (
              <Link
                key={href}
                href={href}
                className={`nav-item nav-subitem ${active ? 'active' : ''}`}
                aria-current={active ? 'page' : undefined}
                role="listitem"
                onClick={onNavigate}
              >
                <Icon size={16} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function SidebarFooter() {
  const { user, branchScoped } = usePermission()
  const { data: branches } = useBranches()
  const branchName = branchScoped
    ? (branches?.find((branch) => branch.id === user.branchId)?.name ?? (user.branchId ? 'Unknown branch' : 'No branch assigned'))
    : 'All branches'

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
