'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { ChevronLeft, X } from 'lucide-react'
import { BrandLogo, NavLinks, SidebarFooter } from '@/components/dashboard/sidebar-nav'
import { Topbar } from '@/components/dashboard/topbar'
import { NoBranchBanner } from '@/components/shared/no-branch-banner'
import { OfflineBanner } from '@/components/shared/offline-banner'
import { useUIStore } from '@/store/ui-store'

function MobileNav() {
  const open = useUIStore((state) => state.mobileNavOpen)
  const setOpen = useUIStore((state) => state.setMobileNavOpen)
  const pathname = usePathname()

  useEffect(() => {
    setOpen(false)
  }, [pathname, setOpen])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, setOpen])

  if (!open) return null

  return (
    <div className="overlay">
      <div className="overlay-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
      <aside className="mobile-nav" aria-label="Mobile navigation">
        <div className="brand">
          <BrandLogo onNavigate={() => setOpen(false)} />
          <button type="button" className="icon-btn collapse-btn" onClick={() => setOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>
        <NavLinks collapsed={false} onNavigate={() => setOpen(false)} />
        <SidebarFooter onNavigate={() => setOpen(false)} />
      </aside>
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const collapsed = useUIStore((state) => state.sidebarCollapsed)
  const toggleSidebar = useUIStore((state) => state.toggleSidebar)

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`} aria-label="Sidebar">
        <button
          type="button"
          className={`sidebar-toggle ${collapsed ? 'is-collapsed' : ''}`}
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
        >
          <ChevronLeft className="sidebar-toggle-icon" size={18} strokeWidth={2} aria-hidden="true" />
        </button>
        <div className="brand">
          <BrandLogo compact={collapsed} />
        </div>
        <NavLinks collapsed={collapsed} />
        <SidebarFooter compact={collapsed} />
      </aside>

      <MobileNav />

      <div className="main-content">
        <Topbar />
        <main id="main" className="page-scroll" tabIndex={-1}>
          <div className="page-content">
            <NoBranchBanner />
            <OfflineBanner />
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
