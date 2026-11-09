'use client'

import { useMemo } from 'react'
import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Package,
  PackagePlus,
  Plus,
  ScanLine,
  Store,
  Truck,
  Users,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { usePermission } from '@/hooks/use-permission'
import { adminHubHref } from '@/lib/admin-hub'
import { inventoryHubHref } from '@/lib/inventory-hub'

export interface QuickCommand {
  id: string
  /** What the row says. Starts with the verb, so the list reads as a to-do. */
  label: string
  /** Where it lands, and what it is for. */
  hint: string
  href: string
  icon: LucideIcon
  group: 'Start' | 'Go to'
  /** Extra words the term is matched against (plurals, old names, Arabic-less
      synonyms staff use out loud) so a near-miss still finds the row. */
  keywords: string[]
}

/**
 * The operations and destinations the palette can jump to.
 *
 * Reaching a form used to mean walking the rail: sidebar → Inventory → the
 * Transfers tab → "Prepare transfer" is three clicks and two page loads before
 * any work starts, and the same shape repeats for receipts, products and
 * reports. Every row here is that whole walk in one keystroke, and each is
 * filtered by the permission the server would check, so the palette never
 * offers a form that ends in a `403`.
 */
export function useQuickCommands(): QuickCommand[] {
  const {
    can,
    canAny,
    canDispatchTransfers,
    canReceiveTransfers,
    canRequestTransfer,
    canManageMinimums,
    canViewFinancialReports,
    canViewAdminWarehouseTools,
    canViewInvoicesLedger,
  } = usePermission()

  return useMemo(() => {
    const commands: QuickCommand[] = []
    const add = (command: QuickCommand) => commands.push(command)

    /* Things that create something. These are what the complaint was about. */
    if (can('sales.create')) {
      add({
        id: 'new-sale',
        label: 'New sale',
        hint: 'Ring up a customer at the till',
        href: '/sales/new',
        icon: ScanLine,
        group: 'Start',
        keywords: ['sell', 'till', 'pos', 'checkout', 'b2c', 'cash'],
      })
      add({
        id: 'new-invoice',
        label: 'Create invoice',
        hint: 'B2C from a sale or B2B from a transfer (API)',
        href: '/sales/invoices/new',
        icon: FileText,
        group: 'Start',
        keywords: ['b2b', 'b2c', 'fiscal', 'bill', 'invoice'],
      })
    }
    if (canRequestTransfer()) {
      const dispatcher = canDispatchTransfers()
      add({
        id: 'new-transfer',
        label: dispatcher ? 'Prepare and send a transfer' : 'Request replenishment',
        hint: dispatcher
          ? 'Move stock between locations and dispatch it in one step'
          : 'Ask the warehouse to restock your branch',
        href: '/transfers/new',
        icon: ArrowLeftRight,
        group: 'Start',
        keywords: ['transfer', 'send stock', 'move stock', 'shipment', 'restock', 'replenish'],
      })
    }
    if (can('stock.adjust')) {
      add({
        id: 'receive-stock',
        label: 'Receive stock from a supplier',
        hint: 'Book a delivery in, or correct a balance',
        href: '/stock-receipts/new',
        icon: PackagePlus,
        group: 'Start',
        keywords: ['receipt', 'supplier', 'delivery', 'goods in', 'adjust'],
      })
    }
    if (canReceiveTransfers()) {
      add({
        id: 'receive-delivery',
        label: 'Confirm an incoming delivery',
        hint: 'Shipments on the road to your location',
        href: inventoryHubHref('receiving'),
        icon: Truck,
        group: 'Start',
        keywords: ['incoming', 'arrived', 'inbound', 'receiving'],
      })
    }
    if (can('catalog.create')) {
      add({
        id: 'new-product',
        label: 'Add a product',
        hint: 'New model with its colors and sizes',
        href: '/products/new',
        icon: Plus,
        group: 'Start',
        keywords: ['product', 'model', 'style', 'create', 'catalog', 'new item'],
      })
    }

    /* Destinations, so the palette replaces the rail as well as the buttons. */
    if (can('locations.view_all')) {
      add({
        id: 'dashboard',
        label: 'Overview',
        hint: 'Figures and trends across locations',
        href: '/dashboard',
        icon: LayoutDashboard,
        group: 'Go to',
        keywords: ['home', 'kpi', 'dashboard', 'start'],
      })
    }
    if (can('stock.view')) {
      add({
        id: 'inventory',
        label: 'Inventory',
        hint: 'Stock by variant with its five balances',
        href: inventoryHubHref('variants'),
        icon: Boxes,
        group: 'Go to',
        keywords: ['stock', 'balances', 'on hand', 'variants'],
      })
      add({
        id: 'transfers-list',
        label: 'Transfers',
        hint: 'Shipments between the warehouse and branches',
        href: inventoryHubHref('transfers'),
        icon: ArrowLeftRight,
        group: 'Go to',
        keywords: ['transfer list', 'drafts', 'on the road'],
      })
    }
    if (canViewInvoicesLedger()) {
      add({
        id: 'invoices',
        label: 'Invoices',
        hint: 'Every sales document with its payment state',
        href: '/sales/invoices',
        icon: FileText,
        group: 'Go to',
        keywords: ['bills', 'documents', 'unpaid'],
      })
    }
    if (can('catalog.view')) {
      add({
        id: 'products',
        label: 'Products',
        hint: 'The catalog, model by model',
        href: '/products',
        icon: Package,
        group: 'Go to',
        keywords: ['catalog', 'models', 'styles'],
      })
    }
    if (canManageMinimums()) {
      add({
        id: 'reorder-levels',
        label: 'Branch minimums',
        hint: 'What each shop should never drop below',
        href: '/reorder-levels',
        icon: ClipboardCheck,
        group: 'Go to',
        keywords: ['reorder', 'minimum', 'par level', 'threshold'],
      })
      add({
        id: 'replenishment',
        label: 'Replenishment',
        hint: 'Branches below their minimum right now',
        href: inventoryHubHref('replenishment'),
        icon: Truck,
        group: 'Go to',
        keywords: ['low stock', 'refill', 'top up'],
      })
    }
    if (canViewAdminWarehouseTools()) {
      add({
        id: 'stock-network',
        label: 'Stock everywhere',
        hint: 'One variant across every location',
        href: '/stock-network',
        icon: Warehouse,
        group: 'Go to',
        keywords: ['network', 'all branches', 'compare'],
      })
    }
    if (canViewFinancialReports()) {
      add({
        id: 'reports',
        label: 'Reports',
        hint: 'Sales, margin and stock movement',
        href: adminHubHref('reports'),
        icon: BarChart3,
        group: 'Go to',
        keywords: ['analytics', 'revenue', 'margin', 'export'],
      })
    }
    if (can('users.manage')) {
      add({
        id: 'users',
        label: 'Employees',
        hint: 'Accounts, roles and the locations they cover',
        href: adminHubHref('users'),
        icon: Users,
        group: 'Go to',
        keywords: ['staff', 'users', 'roles', 'permissions'],
      })
    }
    if (can('locations.view_all')) {
      add({
        id: 'locations',
        label: 'Locations',
        hint: 'Branches and warehouses',
        href: adminHubHref('locations'),
        icon: Store,
        group: 'Go to',
        keywords: ['branches', 'shops', 'warehouse'],
      })
    }
    if (can('settings.manage')) {
      add({
        id: 'settings',
        label: 'Settings',
        hint: 'Store details, currency and exchange rate',
        href: adminHubHref('settings'),
        icon: Store,
        group: 'Go to',
        keywords: ['preferences', 'rate', 'currency', 'config'],
      })
    }

    return commands
  }, [
    can,
    canAny,
    canDispatchTransfers,
    canReceiveTransfers,
    canRequestTransfer,
    canManageMinimums,
    canViewFinancialReports,
    canViewAdminWarehouseTools,
  ])
}

/**
 * Match on the label, the hint and the synonyms, word by word, so "send stock"
 * finds "Prepare and send a transfer" and a typed "transfer" finds both the
 * form and the list. Order is the order declared above: creating comes first,
 * because that is what someone opens the palette to do.
 */
export function filterQuickCommands(commands: QuickCommand[], term: string): QuickCommand[] {
  const needle = term.trim().toLowerCase()
  if (!needle) return commands
  const words = needle.split(/\s+/)
  return commands.filter((command) => {
    const haystack = [command.label, command.hint, ...command.keywords].join(' ').toLowerCase()
    return words.every((word) => haystack.includes(word))
  })
}
