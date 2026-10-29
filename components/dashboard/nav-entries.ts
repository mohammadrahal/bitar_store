'use client'

import {
  ArrowLeftRight,
  Boxes,
  Building2,
  ClipboardCheck,
  ClipboardList,
  LayoutDashboard,
  Package,
  PackagePlus,
  ReceiptText,
  ScanLine,
  ShoppingBag,
  Store,
  Truck,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { usePermission } from '@/hooks/use-permission'
import { isEnabled } from '@/lib/features'

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
  const { user, can, canAny, locationScoped, activeLocationId } = usePermission()
  const items: NavEntry[] = []
  const ownLocation = activeLocationId ?? user.branchId

  if (can('locations.view_all')) items.push({ type: 'link', href: '/dashboard', label: 'Overview', icon: LayoutDashboard })
  if (locationScoped && ownLocation)
    items.push({ type: 'link', href: `/branches/${ownLocation}`, label: 'Overview', icon: LayoutDashboard })
  if (can('stock.view')) items.push({ type: 'link', href: '/inventory', label: 'Inventory', icon: Boxes })
  if (can('catalog.view')) items.push({ type: 'link', href: '/products', label: 'Products', icon: Package })
  if (can('stock.view')) items.push({ type: 'link', href: '/transfers', label: 'Transfers', icon: ArrowLeftRight })

  const salesChildren: NavGroupItem['children'] = []
  if (can('sales.create')) salesChildren.push({ href: '/sales/new', label: 'New sale', icon: ScanLine })
  if (canAny(['sales.view_own', 'sales.view_branch']))
    salesChildren.push({ href: '/sales/b2c', label: 'B2C', icon: ShoppingBag })
  if (can('documents.manage') && isEnabled('b2bSales'))
    salesChildren.push({ href: '/sales/b2b', label: 'B2B', icon: Building2 })
  if (salesChildren.length) items.push({ type: 'group', label: 'Sales', icon: TrendingUp, children: salesChildren })

  if (can('documents.manage')) items.push({ type: 'link', href: '/invoices', label: 'Invoices', icon: ReceiptText })
  if (canAny(['counts.enter', 'counts.apply', 'holds.manage', 'stock.dispose']))
    items.push({ type: 'link', href: '/stock-control', label: 'Stock control', icon: ClipboardCheck })
  if (canAny(['counts.enter', 'opening_stock.post']))
    items.push({ type: 'link', href: '/opening-stock', label: 'Opening stock', icon: ClipboardList })
  if (canAny(['receipts.enter', 'receipts.confirm', 'suppliers.manage']))
    items.push({ type: 'link', href: '/receiving', label: 'Receiving', icon: Truck })
  if (canAny(['movements.request', 'replenishment.review']))
    items.push({ type: 'link', href: '/replenishment', label: 'Replenishment', icon: PackagePlus })
  if (can('users.manage')) items.push({ type: 'link', href: '/users', label: 'Users', icon: Users })
  if (can('locations.view_all')) items.push({ type: 'link', href: '/branches', label: 'Branches', icon: Store })

  return items
}
