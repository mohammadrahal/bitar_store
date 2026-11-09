'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { activeHref, flattenHrefs, useNavEntries, type NavLinkItem, type NavSection } from '@/components/dashboard/nav-entries'
import { adminHubNavPath } from '@/lib/admin-hub'
import { inventoryHubNavPath } from '@/lib/inventory-hub'
import { useBranchScope } from '@/hooks/use-branch-scope'
import { isScopedBranch } from '@/services/attention.service'
import { ALL_BRANCHES } from '@/types'
import { useTransferAttention } from '@/hooks/use-attention'
import { usePermission } from '@/hooks/use-permission'
import { formatNumber } from '@/lib/format'
import { homePathFor } from '@/lib/permissions'
import { readPersistentJson, writePersistentJson } from '@/lib/session-storage'

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

/** The counts the rail carries, from the same query the attention list uses. */
function useNavBadges(): Record<NonNullable<NavLinkItem['badge']>, number> {
  const scope = useBranchScope()
  const { data } = useTransferAttention(scope)
  const incoming =
    scope !== ALL_BRANCHES && isScopedBranch(scope)
      ? (data?.incomingOnRoad ?? 0)
      : (data?.onTheRoad ?? 0)
  return {
    transfer_drafts: data?.awaitingApproval ?? 0,
    incoming,
  }
}

const OPEN_SECTIONS_KEY = 'bitar:nav-open-sections:v1'

/**
 * Which sections are open.
 *
 * The section you are in is always open, whatever is stored: a disclosure that
 * can hide the page you are looking at makes the rail lie about where you are.
 * Everything else is yours to open, and is remembered across visits.
 *
 * The first render does not read storage. Reading it during render would make
 * the server and the client disagree about which rows exist, which React treats
 * as a hydration error; the stored set is applied in an effect instead, so the
 * rail opens at its default for one frame and then settles.
 */
function useOpenSections(sections: NavSection[], currentSection: string | null) {
  const [stored, setStored] = useState<string[] | null>(null)

  useEffect(() => {
    setStored(readPersistentJson<string[]>(OPEN_SECTIONS_KEY, []))
  }, [])

  const toggle = useCallback(
    (label: string) => {
      setStored((previous) => {
        const base = previous ?? []
        const next = base.includes(label) ? base.filter((entry) => entry !== label) : [...base, label]
        try {
          writePersistentJson(OPEN_SECTIONS_KEY, next)
        } catch {
          /* Private windows and blocked site data: the rail still works, it
             just forgets. Nothing here is worth failing a click over. */
        }
        return next
      })
    },
    [],
  )

  const isOpen = useCallback(
    (label: string) => {
      if (label === currentSection) return true
      /* Before storage is read, show the section you are in and nothing else:
         the shortest rail that still answers "where am I". */
      if (stored === null) return false
      return stored.includes(label)
    },
    [currentSection, stored],
  )

  return { isOpen, toggle, sections }
}

export function NavLinks({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const sections = useNavEntries()
  const navPathname = useMemo(() => {
    const mapped = inventoryHubNavPath(pathname) ?? adminHubNavPath(pathname) ?? pathname
    if (mapped === '/admin' && searchParams.toString().length > 0) {
      return `/admin?${searchParams.toString()}`
    }
    return mapped
  }, [pathname, searchParams])
  const current = activeHref(navPathname, flattenHrefs(sections))
  const badges = useNavBadges()

  /* The section holding the active link, so it can be opened for you. */
  const currentSection = useMemo(
    () => sections.find((section) => section.links.some((item) => item.href === current))?.label ?? null,
    [sections, current],
  )

  const { isOpen, toggle } = useOpenSections(sections, currentSection)

  const countOf = (badge: NavLinkItem['badge']) => (badge ? badges[badge] : 0)

  const badgeTotal = (item: NavLinkItem) => {
    const keys = item.badges ?? (item.badge ? [item.badge] : [])
    return keys.reduce((sum, key) => sum + countOf(key), 0)
  }

  const link = (item: NavLinkItem) => {
    const { href, label, icon: Icon } = item
    const active = href === current
    const count = badgeTotal(item)
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
        {/* A count only appears when there is something waiting, so the rail is
            quiet when nothing needs doing. Collapsed, it becomes a dot. there
            is no room for a figure, and that something is waiting is the part
            worth keeping. */}
        {count > 0 &&
          (collapsed ? (
            <span className="nav-badge-dot" aria-label={`${formatNumber(count)} waiting`} />
          ) : (
            <span className="nav-badge tabular">
              {formatNumber(count)}
              <span className="sr-only"> waiting</span>
            </span>
          ))}
      </Link>
    )
  }

  return (
    <nav className="nav-list" aria-label="Main">
      {sections.map((section) => {
        const rows = <>{section.links.map(link)}</>

        /* The unlabelled first section is the overview: one link, nothing to
           disclose. */
        if (!section.label) {
          return (
            <div className="nav-section" key="overview">
              {rows}
            </div>
          )
        }

        const open = isOpen(section.label)
        const id = `nav-section-${section.label.toLowerCase()}`
        const waiting = section.links.reduce((sum, item) => sum + badgeTotal(item), 0)

        return (
          <div className="nav-section" key={section.label}>
            <button
              type="button"
              className="nav-section-toggle"
              aria-expanded={open}
              aria-controls={id}
              onClick={() => toggle(section.label)}
            >
              <span>{section.label}</span>
              {/* Closed, what is waiting inside comes up onto the label.
                  Open, the rows carry their own counts and a second copy up
                  here would be the same fact twice. */}
              {!open && waiting > 0 && (
                <span className="nav-badge tabular">
                  {formatNumber(waiting)}
                  <span className="sr-only"> waiting</span>
                </span>
              )}
              <ChevronRight size={16} className="nav-section-chevron" aria-hidden="true" />
            </button>
            <div className="nav-section-links" id={id} data-open={open}>
              <div className="nav-section-rows" inert={!open || undefined}>
                {rows}
              </div>
            </div>
          </div>
        )
      })}
    </nav>
  )
}
