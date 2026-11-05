'use client'

import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  FileText,
  History,
  LayoutDashboard,
  Package,
  PackageCheck,
  PackagePlus,
  ScanLine,
  ScrollText,
  Settings,
  Store,
  Tags,
  Truck,
  Users,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { useBranchHref } from '@/hooks/use-branches'
import { usePermission } from '@/hooks/use-permission'

export interface NavLinkItem {
  href: string
  label: string
  icon: LucideIcon
  /** Which figure, if any, this link shows a count for. */
  badge?: 'transfer_drafts' | 'incoming'
}

export interface NavSection {
  /** Small uppercase label above the group. Sections with no links are dropped. */
  label: string
  links: NavLinkItem[]
}

export function flattenHrefs(sections: NavSection[]): string[] {
  return sections.flatMap((section) => section.links.map((link) => link.href))
}

/** The most specific matching link wins, so /branches/:id never lights up two items. */
export function activeHref(pathname: string, hrefs: string[]) {
  return (
    hrefs
      .filter((href) => {
        const path = href.split('?')[0]
        return pathname === path || pathname.startsWith(`${path}/`)
      })
      .sort((a, b) => b.length - a.length)[0] ?? null
  )
}

/**
 * Navigation as four flat sections rather than collapsing groups.
 *
 * A disclosure that has to be opened to find a link costs a click on every
 * visit and hides where you are; four labelled sections of plain links show the
 * whole shape of the app at once and still fit a 1366x768 rail without
 * scrolling. Links are derived from permissions, so a role never sees one it
 * cannot open, and a section with nothing left in it disappears rather than
 * leaving a heading over a gap.
 *
 * Three links the brief asked for have no backend: **Social orders**,
 * **Suppliers** and **Stock control** (physical counts and holds). They are
 * absent rather than stubbed, and listed in `ARCHITECTURE.md` section 9.
 */
export function useNavEntries(): NavSection[] {
  const {
    user,
    can,
    canAny,
    locationScoped,
    activeLocationId,
    canSeeTransfers,
    canReceiveTransfers,
    canDispatchTransfers,
    canManageMinimums,
    canViewFinancialReports,
    canViewAdminWarehouseTools,
    superAdmin,
  } = usePermission()
  const hrefOf = useBranchHref()
  const ownLocation = activeLocationId ?? user.branchId

  const overview: NavLinkItem[] = []
  if (can('locations.view_all')) {
    overview.push({ href: '/dashboard', label: 'Overview', icon: LayoutDashboard })
  } else if (locationScoped && ownLocation) {
    overview.push({ href: hrefOf(ownLocation), label: 'Overview', icon: LayoutDashboard })
  }

  const sell: NavLinkItem[] = []
  if (can('sales.create')) sell.push({ href: '/sales/new', label: 'New sale', icon: ScanLine })
  if (canAny(['sales.create', 'sales.view_own', 'sales.view_branch'])) {
    sell.push({ href: '/sales/invoices', label: 'Invoices', icon: FileText })
  }
  /* "B2C" and "Today" were the same list as history, narrowed to one shop day,
     so they are gone: one way in, with the date filter already on it. */
  if (canAny(['sales.view_own', 'sales.view_branch'])) {
    sell.push({ href: '/sales/history', label: 'Sales history', icon: History })
  }

  const stock: NavLinkItem[] = []
  if (can('stock.view')) stock.push({ href: '/inventory', label: 'Inventory', icon: Boxes })
  if (canDispatchTransfers()) {
    stock.push({ href: '/transfers', label: 'Transfers', icon: ArrowLeftRight, badge: 'transfer_drafts' })
  }
  /* Receiving is the destination's side of the same endpoint, so it is the
     transfer list already filtered to what is on its way here. */
  if (canReceiveTransfers()) {
    stock.push({
      href: '/transfers?status=dispatched',
      label: 'Receiving',
      icon: PackageCheck,
      badge: 'incoming',
    })
  }
  if (!canDispatchTransfers() && !canReceiveTransfers() && canSeeTransfers()) {
    stock.push({ href: '/transfers', label: 'Transfers', icon: ArrowLeftRight, badge: 'transfer_drafts' })
  }
  /* Receiving a delivery is how stock gets in after a location has been opened,
     so it sits with the rest of Stock rather than under Admin. */
  if (can('stock.adjust')) {
    stock.push({ href: '/stock-receipts', label: 'Receive stock', icon: PackagePlus })
  }
  if (canManageMinimums()) {
    stock.push({ href: '/replenishment', label: 'Replenishment', icon: Truck })
    stock.push({ href: '/reorder-levels', label: 'Branch minimums', icon: ClipboardCheck })
  }
  if (canViewAdminWarehouseTools()) {
    stock.push({ href: '/stock-network', label: 'Stock everywhere', icon: Warehouse })
  }

  const catalog: NavLinkItem[] = []
  if (can('catalog.view')) catalog.push({ href: '/products', label: 'Products', icon: Package })
  if (can('catalog.create')) catalog.push({ href: '/categories', label: 'Categories', icon: Tags })

  const admin: NavLinkItem[] = []
  if (can('users.manage')) admin.push({ href: '/users', label: 'Users', icon: Users })
  if (can('locations.view_all')) admin.push({ href: '/branches', label: 'Locations', icon: Store })
  if (can('opening_stock.post')) admin.push({ href: '/opening-stock', label: 'Opening stock', icon: ClipboardList })
  if (canViewFinancialReports()) admin.push({ href: '/reports', label: 'Reports', icon: BarChart3 })
  if (canViewAdminWarehouseTools()) admin.push({ href: '/audit', label: 'Audit log', icon: ScrollText })
  if (superAdmin || can('settings.manage')) {
    admin.push({ href: '/settings', label: 'Settings', icon: Settings })
  }

  return [
    { label: '', links: overview },
    { label: 'Sell', links: sell },
    { label: 'Stock', links: stock },
    { label: 'Catalog', links: catalog },
    { label: 'Admin', links: admin },
  ].filter((section) => section.links.length > 0)
}
