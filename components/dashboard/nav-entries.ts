'use client'

import {
  Banknote,
  BarChart3,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  FileText,
  History,
  LayoutDashboard,
  Package,
  ScanLine,
  ScrollText,
  Settings,
  Tags,
  Truck,
  Undo2,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { useBranchHref } from '@/hooks/use-branches'
import { usePermission } from '@/hooks/use-permission'
import { adminHubHref } from '@/lib/admin-hub'

export interface NavLinkItem {
  href: string
  label: string
  icon: LucideIcon
  /** Which figure, if any, this link shows a count for. */
  badge?: 'transfer_drafts' | 'incoming'
  /** Sum of several badge channels on one link (e.g. inventory hub). */
  badges?: ('transfer_drafts' | 'incoming')[]
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
export function activeHref(current: string, hrefs: string[]) {
  return (
    hrefs
      .filter((href) => {
        if (href.includes('?')) {
          return current === href
        }
        const path = href.split('?')[0]
        const curPath = current.split('?')[0]
        return curPath === path || curPath.startsWith(`${path}/`)
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
 * **Suppliers** uses `GET /suppliers`. **Social orders** and **Stock control**
 * (physical counts and holds) still have no backend and stay absent.
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
    canSeeReturns,
    canViewAdminWarehouseTools,
    canViewInvoicesLedger,
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
  if (canViewInvoicesLedger()) {
    sell.push({ href: '/sales/invoices', label: 'Invoices', icon: FileText })
  }
  /* "B2C" and "Today" were the same list as history, narrowed to one shop day,
     so they are gone: one way in, with the date filter already on it. */
  if (canAny(['sales.view_own', 'sales.view_branch'])) {
    sell.push({ href: '/sales/history', label: 'Sales history', icon: History })
  }
  /* The drawer sits with the till, not under Admin: the person who opens it and
     counts it is the cashier. A manager's review list is a tab on the same
     screen, so one nav item covers both. */
  if (canAny(['cash.open', 'cash.accept', 'cash.close', 'cash.move'])) {
    sell.push({ href: '/cash', label: 'Cash drawer', icon: Banknote })
  }
  /* Returns sit with the till for the same reason: the person who takes goods
     back is standing at the counter. A manager's approve/release work is on
     each return rather than a screen of its own, so one nav item covers both.
     `canSeeReturns` is true for a manager by role, since deciding a return is
     not a grantable permission. */
  if (canSeeReturns()) {
    sell.push({ href: '/returns', label: 'Returns', icon: Undo2 })
  }

  const stock: NavLinkItem[] = []
  if (can('stock.view')) {
    /* Transfers, receiving, supplier receipts and replenishment live under
       Inventory as tabs; badges roll up onto this one link. */
    const hubBadges: ('transfer_drafts' | 'incoming')[] = []
    if (canDispatchTransfers() || (!canDispatchTransfers() && !canReceiveTransfers() && canSeeTransfers())) {
      hubBadges.push('transfer_drafts')
    }
    if (canReceiveTransfers()) hubBadges.push('incoming')
    stock.push({
      href: '/inventory',
      label: 'Warehouse',
      icon: Boxes,
      ...(hubBadges.length > 0 ? { badges: hubBadges } : {}),
    })
  }
  if (canManageMinimums()) {
    stock.push({ href: '/reorder-levels', label: 'Branch minimums', icon: ClipboardCheck })
  }
  if (canViewAdminWarehouseTools()) {
    stock.push({ href: '/stock-network', label: 'Stock everywhere', icon: Warehouse })
  }
  if (can('stock.adjust')) {
    stock.push({ href: '/suppliers', label: 'Suppliers', icon: Truck })
  }

  const catalog: NavLinkItem[] = []
  if (can('catalog.view')) catalog.push({ href: '/products', label: 'Products', icon: Package })
  if (can('catalog.create')) catalog.push({ href: '/categories', label: 'Categories', icon: Tags })

  const admin: NavLinkItem[] = []
  const showAdminSection =
    can('opening_stock.post') ||
    canViewFinancialReports() ||
    canViewAdminWarehouseTools() ||
    can('users.manage') ||
    can('locations.view_all') ||
    can('settings.manage')
  if (showAdminSection) {
    /* The hub opens on its first visible tab (Employees, then Locations, then
       Settings); a bare path also keeps this lit on any of those tabs. */
    if (can('users.manage') || can('locations.view_all') || can('settings.manage')) {
      admin.push({ href: '/admin', label: 'Settings', icon: Settings })
    }
    if (can('opening_stock.post')) {
      admin.push({ href: adminHubHref('opening-stock'), label: 'Opening stock', icon: ClipboardList })
    }
    if (canViewFinancialReports()) {
      admin.push({ href: adminHubHref('reports'), label: 'Reports', icon: BarChart3 })
    }
    if (canViewAdminWarehouseTools()) {
      admin.push({ href: adminHubHref('audit'), label: 'Audit log', icon: ScrollText })
    }
  }

  return [
    { label: '', links: overview },
    { label: 'Sell', links: sell },
    { label: 'Stock', links: stock },
    { label: 'Catalog', links: catalog },
    { label: 'Admin', links: admin },
  ].filter((section) => section.links.length > 0)
}
