'use client'

import { useEffect, useId, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { ChevronLeft, X } from 'lucide-react'
import { BrandLogo, NavLinks, SidebarFooter } from '@/components/dashboard/sidebar-nav'
import { Topbar } from '@/components/dashboard/topbar'
import { NoBranchBanner } from '@/components/shared/no-branch-banner'
import { OfflineBanner } from '@/components/shared/offline-banner'
import { useModalBehavior } from '@/hooks/use-modal-behavior'
import { useUIStore } from '@/store/ui-store'

/**
 * Split from MobileNav so the panel only exists while the menu is open, which
 * is what useModalBehavior needs: it runs its focus trap, scroll lock and
 * focus restore on mount and unwinds them on unmount.
 */
function MobileNavPanel({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLElement>(null)
  const titleId = useId()
  useModalBehavior(ref, onClose)

  return (
    <div className="overlay">
      <div className="overlay-backdrop" onClick={onClose} aria-hidden="true" />
      <aside ref={ref} className="mobile-nav" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId} className="sr-only">
          Navigation
        </h2>
        <div className="brand">
          <BrandLogo onNavigate={onClose} />
          <button type="button" className="icon-btn collapse-btn" onClick={onClose} aria-label="Close menu" data-autofocus>
            <X size={18} />
          </button>
        </div>
        <NavLinks collapsed={false} onNavigate={onClose} />
        <SidebarFooter onNavigate={onClose} />
      </aside>
    </div>
  )
}

function MobileNav() {
  const open = useUIStore((state) => state.mobileNavOpen)
  const setOpen = useUIStore((state) => state.setMobileNavOpen)
  const pathname = usePathname()

  useEffect(() => {
    setOpen(false)
  }, [pathname, setOpen])

  if (!open) return null
  return <MobileNavPanel onClose={() => setOpen(false)} />
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const collapsed = useUIStore((state) => state.sidebarCollapsed)
  const toggleSidebar = useUIStore((state) => state.toggleSidebar)
  const pathname = usePathname()
  const mainRef = useRef<HTMLElement>(null)

  /* The shell scrolls this column rather than the document, and the router's
     own scroll restoration only ever touches the document scroller. Without
     this, opening a record from halfway down a table lands on a detail page
     that is already scrolled past its heading. */
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [pathname])

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
        <main id="main" ref={mainRef} className="page-scroll" tabIndex={-1}>
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
