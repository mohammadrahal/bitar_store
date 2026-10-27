'use client'

import {
  ArrowLeftRight,
  Boxes,
  Building2,
  ClipboardCheck,
  LayoutDashboard,
  Package,
  PackagePlus,
  ReceiptText,
  ScanLine,
  ShoppingBag,
  Store,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'
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
  const { user, can, branchScoped } = usePermission()
  const items: NavEntry[] = []

  if (can('branches:view-all')) items.push({ type: 'link', href: '/dashboard', label: 'Overview', icon: LayoutDashboard })
  if (branchScoped && user.branchId)
    items.push({ type: 'link', href: `/branches/${user.branchId}`, label: 'Overview', icon: LayoutDashboard })
  if (can('inventory:read')) items.push({ type: 'link', href: '/inventory', label: 'Inventory', icon: Boxes })
  if (can('products:read')) items.push({ type: 'link', href: '/products', label: 'Products', icon: Package })
  if (can('transfers:read')) items.push({ type: 'link', href: '/transfers', label: 'Transfers', icon: ArrowLeftRight })

  const salesChildren: NavGroupItem['children'] = []
  if (can('sales:b2c:create')) salesChildren.push({ href: '/sales/new', label: 'New sale', icon: ScanLine })
  if (can('sales:b2c:read')) salesChildren.push({ href: '/sales/b2c', label: 'B2C', icon: ShoppingBag })
  if (can('sales:b2b:read')) salesChildren.push({ href: '/sales/b2b', label: 'B2B', icon: Building2 })
  if (salesChildren.length) items.push({ type: 'group', label: 'Sales', icon: TrendingUp, children: salesChildren })

  if (can('invoices:read')) items.push({ type: 'link', href: '/invoices', label: 'Invoices', icon: ReceiptText })
  if (can('stock:report'))
    items.push({ type: 'link', href: '/stock-control', label: 'Stock control', icon: ClipboardCheck })
  if (can('replenishment:read'))
    items.push({ type: 'link', href: '/replenishment', label: 'Replenishment', icon: PackagePlus })
  if (can('users:manage')) items.push({ type: 'link', href: '/users', label: 'Users', icon: Users })
  if (can('branches:manage')) items.push({ type: 'link', href: '/branches', label: 'Branches', icon: Store })

  return items
}
