'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  LayoutDashboard,
  Menu,
  Package,
  Settings,
  Store,
  Truck,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useInventory } from '@/components/inventory/inventory-provider'
import { selectInTransit, selectStockAlerts } from '@/lib/inventory/selectors'
import { ALL_BRANCHES } from '@/lib/inventory/types'

const navItems: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/movements', label: 'Stock movements', icon: ClipboardList },
  { href: '/branches', label: 'Branches', icon: Store },
]

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function BrandLogo({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  return (
    <Link href="/" className={`brand-logo ${compact ? 'compact' : ''}`} onClick={onNavigate}>
      <Image className="logo-full" src="/bitar-logo.png" alt="Bitar Fashion" width={713} height={154} priority />
      <Image className="logo-mark" src="/bitar-mark.png" alt="Bitar Fashion" width={141} height={154} priority />

    </Link>
  )
}

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}

function NavLinks({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname()
  const { state, scope } = useInventory()
  const alertCount = selectStockAlerts(state, scope).length

  return (
    <nav className="nav-list" aria-label="Main">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href)
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
            {!collapsed && href === '/products' && alertCount > 0 && (
              <span className="nav-badge" aria-label={`${alertCount} stock alerts`}>
                {alertCount}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}

function SidebarFooter({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  const { state } = useInventory()
  const active = pathname.startsWith('/settings')
  return (
    <div className="sidebar-bottom">
      <Link href="/settings" className={`nav-item ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined} onClick={onNavigate}>
        <Settings size={18} aria-hidden="true" />
        <span>Settings</span>
      </Link>
      <div className="user-row">
        <div className="avatar">{initials(state.settings.userName)}</div>
        <div>
          <strong>{state.settings.userName}</strong>
          <small>Admin</small>
        </div>
      </div>
    </div>
  )
}

function Notifications() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { state, scope, branchName } = useInventory()
  const alerts = selectStockAlerts(state, scope)
  const transit = selectInTransit(state, scope)
  const count = alerts.length + transit.length

  useEffect(() => {
    if (!open) return
    function onPointer(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="popover-anchor" ref={ref}>
      <button
        type="button"
        className="icon-btn notification"
        aria-label={count ? `Notifications, ${count} items` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={18} />
        {count > 0 && <i aria-hidden="true" />}
      </button>
      {open && (
        <div className="popover" role="region" aria-label="Notifications">
          <div className="popover-head">
            <strong>Notifications</strong>
            <span className="muted">{count}</span>
          </div>
          {count === 0 ? (
            <p className="popover-empty">You’re all caught up.</p>
          ) : (
            <ul className="popover-list">
              {transit.slice(0, 3).map((m) => (
                <li key={m.id}>
                  <Link href="/movements?status=in_transit" onClick={() => setOpen(false)}>
                    <span className="attention-icon">
                      <Truck size={15} />
                    </span>
                    <span>
                      <strong>
                        {m.qty} × {m.productName} in transit
                      </strong>
                      <small>
                        {branchName(m.branchId)} → {branchName(m.toBranchId)} · {m.reference}
                      </small>
                    </span>
                  </Link>
                </li>
              ))}
              {alerts.slice(0, 5).map((a) => (
                <li key={`${a.productId}-${a.branchId}`}>
                  <Link href={`/products?status=${a.status}`} onClick={() => setOpen(false)}>
                    <span className={`attention-icon ${a.status === 'out' ? 'red' : ''}`}>
                      <CircleAlert size={15} />
                    </span>
                    <span>
                      <strong>
                        {a.productName} {a.status === 'out' ? 'is out of stock' : 'is running low'}
                      </strong>
                      <small>
                        {branchName(a.branchId)} · {a.onHand} of {a.reorderPoint} min
                      </small>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const { state, scope, setScope } = useInventory()

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!mobileOpen) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setMobileOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} aria-label="Sidebar">
        <div className="brand">
          <BrandLogo compact={collapsed} />
          <button
            type="button"
            className="icon-btn collapse-btn"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
        <NavLinks collapsed={collapsed} />
        {!collapsed && <SidebarFooter />}
      </aside>

      {mobileOpen && (
        <div className="overlay overlay-mobile-nav">
          <div className="overlay-backdrop" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <aside className="mobile-nav" aria-label="Mobile navigation">
            <div className="brand">
              <BrandLogo onNavigate={() => setMobileOpen(false)} />
              <button type="button" className="icon-btn collapse-btn" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <X size={18} />
              </button>
            </div>
            <NavLinks collapsed={false} onNavigate={() => setMobileOpen(false)} />
            <SidebarFooter onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="main-content">
        <header className="topbar">
          <div className="mobile-brand">
            <button type="button" className="icon-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu" aria-expanded={mobileOpen}>
              <Menu size={20} />
            </button>
            <BrandLogo />
          </div>
          <div className="top-actions">
            <label className="branch-switcher">
              <span className="switcher-dot" aria-hidden="true" />
              <span className="sr-only">Branch scope</span>
              <select value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value={ALL_BRANCHES}>All branches</option>
                {state.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <Notifications />
            <Link href="/settings" className="avatar avatar-link" aria-label="Account settings">
              {initials(state.settings.userName)}
            </Link>
          </div>
        </header>
        <main id="main" className="page-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  )
}
