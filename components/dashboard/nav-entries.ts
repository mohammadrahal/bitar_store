'use client'

import {
  Boxes,
  ClipboardList,
  LayoutDashboard,
  Package,
  ScanLine,
  ShoppingBag,
  Store,
  TrendingUp,
  Users,
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
  const { user, can, canAny, locationScoped, activeLocationId } = usePermission()
  const hrefOf = useBranchHref()
  const items: NavEntry[] = []
  const ownLocation = activeLocationId ?? user.branchId

  if (can('locations.view_all')) items.push({ type: 'link', href: '/dashboard', label: 'Overview', icon: LayoutDashboard })
  if (locationScoped && ownLocation)
    items.push({ type: 'link', href: hrefOf(ownLocation), label: 'Overview', icon: LayoutDashboard })
  if (can('stock.view')) items.push({ type: 'link', href: '/inventory', label: 'Inventory', icon: Boxes })
  if (can('catalog.view')) items.push({ type: 'link', href: '/products', label: 'Products', icon: Package })

  const salesChildren: NavGroupItem['children'] = []
  if (can('sales.create')) salesChildren.push({ href: '/sales/new', label: 'New sale', icon: ScanLine })
  if (canAny(['sales.view_own', 'sales.view_branch']))
    salesChildren.push({ href: '/sales/b2c', label: 'Today', icon: ShoppingBag })
  if (salesChildren.length) items.push({ type: 'group', label: 'Sales', icon: TrendingUp, children: salesChildren })

  if (can('opening_stock.post'))
    items.push({ type: 'link', href: '/opening-stock', label: 'Opening stock', icon: ClipboardList })
  if (can('users.manage')) items.push({ type: 'link', href: '/users', label: 'Users', icon: Users })
  if (can('locations.view_all')) items.push({ type: 'link', href: '/branches', label: 'Branches', icon: Store })

  return items
}
