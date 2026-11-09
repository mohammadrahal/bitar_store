'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo } from 'react'
import { Settings, Store, Users, type LucideIcon } from 'lucide-react'
import { AuditView } from '@/components/audit/audit-view'
import { BranchesView } from '@/components/branches/branches-view'
import { OpeningStockView } from '@/components/opening-stock/opening-stock-view'
import { PageHeader } from '@/components/shared/page-header'
import { ReportsView } from '@/components/reports/reports-view'
import { StoreSettingsView } from '@/components/settings/store-settings-view'
import { UsersView } from '@/components/users/users-view'
import { usePermission } from '@/hooks/use-permission'

import { cn } from '@/lib/utils'
import { adminHubHref, parseAdminHubSection, type AdminHubSection } from '@/lib/admin-hub'

type TabDef = {
  id: AdminHubSection
  label: string
  icon: LucideIcon
  visible: boolean
}

const SECTION_COPY: Record<
  AdminHubSection,
  { title: string; description: string }
> = {
  users: {
    title: 'Employees',
    description: 'Deactivating blocks sign-in and can be undone. Deleting removes the account; sales they rang up keep their name.',
  },
  locations: {
    title: 'Branches',
    description: 'Create stores, choose which one is the main warehouse, and assign people from the Employees tab.',
  },
  'opening-stock': {
    title: 'Opening stock',
    description: 'Count what is physically at a location and post it. A SKU is opened once; after that its differences are settled by a physical count.',
  },
  reports: {
    title: 'Reports',
    description: 'Revenue and payment mix by shop day (Lebanon time). Needs reports.financial on the server.',
  },
  audit: {
    title: 'Audit log',
    description: 'Who changed minimums, branches and other settings. Admin only on the server.',
  },
  settings: {
    title: 'Store settings',
    description: 'Rates and rules that every branch uses on the till.',
  },
}

export function AdminHubView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { can, canViewFinancialReports, canViewAdminWarehouseTools } = usePermission()

  const showUsers = can('users.manage')
  const showLocations = can('locations.view_all')
  const showOpeningStock = can('opening_stock.post')
  const showReports = canViewFinancialReports()
  const showAudit = canViewAdminWarehouseTools()
  const showSettings = can('settings.manage')

  const hasAnyAdmin =
    showUsers || showLocations || showOpeningStock || showReports || showAudit || showSettings

  /** Top tabs: employees, locations, settings only. opening stock, reports and audit live in the sidebar. */
  const tabs: TabDef[] = useMemo(
    () =>
      (
        [
          { id: 'users', label: 'Employees', icon: Users, visible: showUsers },
          { id: 'locations', label: 'Locations', icon: Store, visible: showLocations },
          { id: 'settings', label: 'Settings', icon: Settings, visible: showSettings },
        ] satisfies TabDef[]
      ).filter((t) => t.visible),
    [showUsers, showLocations, showSettings],
  )

  const requested = parseAdminHubSection(searchParams.get('section'))

  const sectionAllowed = (id: AdminHubSection): boolean => {
    if (id === 'users') return showUsers
    if (id === 'locations') return showLocations
    if (id === 'opening-stock') return showOpeningStock
    if (id === 'reports') return showReports
    if (id === 'audit') return showAudit
    if (id === 'settings') return showSettings
    return false
  }

  const fallbackSection = useMemo((): AdminHubSection => {
    if (showUsers) return 'users'
    if (showLocations) return 'locations'
    if (showSettings) return 'settings'
    if (showOpeningStock) return 'opening-stock'
    if (showReports) return 'reports'
    if (showAudit) return 'audit'
    return 'users'
  }, [showUsers, showLocations, showSettings, showOpeningStock, showReports, showAudit])

  const section: AdminHubSection = useMemo(() => {
    if (requested && sectionAllowed(requested)) return requested
    if (tabs[0]?.id) return tabs[0].id
    return fallbackSection
  }, [requested, tabs, fallbackSection])

  useEffect(() => {
    if (searchParams.get('section') === section) return
    const next = new URLSearchParams(searchParams.toString())
    next.set('section', section)
    router.replace(`/admin?${next.toString()}`, { scroll: false })
  }, [section, router, searchParams])

  const copy = SECTION_COPY[section]

  if (!hasAnyAdmin) {
    return (
      <PageHeader
        eyebrow="Admin"
        title="Admin"
        description="Your account does not have access to any admin tools."
      />
    )
  }

  return (
    <>
      <PageHeader eyebrow="Admin" title={copy.title} description={copy.description} />

      {tabs.length > 0 ? (
        <div className="inventory-hub-tabs" role="tablist" aria-label="Admin sections">
          {tabs.map(({ id, label, icon: Icon }) => {
            const href = adminHubHref(id)
            const selected = id === section
            return (
              <Link
                key={id}
                href={href}
                scroll={false}
                role="tab"
                aria-selected={selected}
                className={cn('inventory-hub-tab', selected && 'inventory-hub-tab--active')}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </Link>
            )
          })}
        </div>
      ) : null}

      <div className="admin-hub-panel" role="tabpanel" id={`admin-section-${section}`}>
        {section === 'users' && showUsers && <UsersView embedded />}
        {section === 'locations' && showLocations && <BranchesView embedded />}
        {section === 'opening-stock' && showOpeningStock && <OpeningStockView embedded />}
        {section === 'reports' && showReports && <ReportsView embedded />}
        {section === 'audit' && showAudit && <AuditView embedded />}
        {section === 'settings' && showSettings && <StoreSettingsView embedded />}
      </div>
    </>
  )
}
