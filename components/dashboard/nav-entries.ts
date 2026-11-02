'use client'

import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  ClipboardCheck,
  ClipboardList,
  LayoutDashboard,
  Package,
  ReceiptText,
  ScanLine,
  ScrollText,
  ShoppingBag,
  Store,
  TrendingUp,
  Truck,
  Users,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { useBranchHref } from '@/hooks/use-branches'
import { usePermission } from '@/hooks/use-permission'

export interface NavLinkItem {
  type: 'link'
  href: string
  label: string
  icon: LucideIcon
}

export interface NavGroupItem {
  type: 'group'
  label: string
  icon: LucideIcon
  children: { href: string; label: string; icon: LucideIcon }[]
}

export type NavEntry = NavLinkItem | NavGroupItem

export function flattenHrefs(entries: NavEntry[]): string[] {
  return entries.flatMap((entry) => (entry.type === 'link' ? [entry.href] : entry.children.map((child) => child.href)))
}

/** The most specific matching link wins, so /branches/:id never lights up two items. */
export function activeHref(pathname: string, hrefs: string[]) {
  return (
    hrefs
      .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
      .sort((a, b) => b.length - a.length)[0] ?? null
  )
}

/** Navigation is derived from permissions, so a role never sees a link it cannot open. */
export function useNavEntries(): NavEntry[] {
  const {
    user,
    can,
    canAny,
    locationScoped,
    activeLocationId,
    canSeeTransfers,
    canRequestTransfer,
    canDispatchTransfers,
    canManageMinimums,
    canViewFinancialReports,
    canViewAdminWarehouseTools,
  } = usePermission()
  const hrefOf = useBranchHref()
  const items: NavEntry[] = []
  const ownLocation = activeLocationId ?? user.branchId

  if (can('locations.view_all')) items.push({ type: 'link', href: '/dashboard', label: 'Overview', icon: LayoutDashboard })
  if (locationScoped && ownLocation)
    items.push({ type: 'link', href: hrefOf(ownLocation), label: 'Overview', icon: LayoutDashboard })
  if (can('stock.view')) {
    const inventoryChildren: NavGroupItem['children'] = [{ href: '/inventory', label: 'On hand', icon: Boxes }]
    if (canRequestTransfer() && !canDispatchTransfers()) {
      inventoryChildren.push({ href: '/transfers/new', label: 'Request replenishment', icon: ClipboardList })
    }
    if (inventoryChildren.length === 1) {
      items.push({ type: 'link', href: '/inventory', label: 'Inventory', icon: Boxes })
    } else {
      items.push({ type: 'group', label: 'Inventory', icon: Boxes, children: inventoryChildren })
    }
  }
  if (can('catalog.view')) items.push({ type: 'link', href: '/products', label: 'Products', icon: Package })

  const salesChildren: NavGroupItem['children'] = []
  const networkSales = can('locations.view_all')
  const canSeeSales = canAny(['sales.view_own', 'sales.view_branch'])
  if (can('sales.create')) salesChildren.push({ href: '/sales/new', label: 'New sale', icon: ScanLine })
  if (canSeeSales) {
    salesChildren.push({ href: '/sales/invoices', label: 'Invoices', icon: ReceiptText })
    if (networkSales) {
      salesChildren.push({ href: '/sales/b2c', label: 'B2C', icon: ShoppingBag })
    } else {
      salesChildren.push({ href: '/sales/b2c', label: 'Today', icon: ShoppingBag })
    }
  }
  if (salesChildren.length) items.push({ type: 'group', label: 'Sales', icon: TrendingUp, children: salesChildren })

  if (can('opening_stock.post'))
    items.push({ type: 'link', href: '/opening-stock', label: 'Opening stock', icon: ClipboardList })

  const warehouseChildren: NavGroupItem['children'] = []
  if (canViewAdminWarehouseTools()) warehouseChildren.push({ href: '/stock-network', label: 'Stock everywhere', icon: Warehouse })
  if (canManageMinimums()) {
    warehouseChildren.push({ href: '/replenishment', label: 'What to send', icon: Truck })
    warehouseChildren.push({ href: '/reorder-levels', label: 'Branch minimums', icon: ClipboardCheck })
  }
  if (canSeeTransfers()) {
    warehouseChildren.push({
      href: '/transfers',
      label: 'Transfers',
      icon: ArrowLeftRight,
    })
  }
  if (warehouseChildren.length) items.push({ type: 'group', label: 'Warehouse', icon: Warehouse, children: warehouseChildren })

  if (canViewFinancialReports()) items.push({ type: 'link', href: '/reports', label: 'Reports', icon: BarChart3 })
  if (canViewAdminWarehouseTools()) items.push({ type: 'link', href: '/audit', label: 'Audit log', icon: ScrollText })

  if (can('users.manage')) items.push({ type: 'link', href: '/users', label: 'Employees', icon: Users })
  if (can('locations.view_all')) items.push({ type: 'link', href: '/branches', label: 'Branches', icon: Store })

  return items
}
