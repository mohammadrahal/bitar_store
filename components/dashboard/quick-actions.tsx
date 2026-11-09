'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowLeftRight, PackagePlus, PackageSearch, Plus, ScanLine, Truck, X, type LucideIcon } from 'lucide-react'
import { usePermission } from '@/hooks/use-permission'
import { inventoryHubHref } from '@/lib/inventory-hub'

interface Action {
  href: string
  label: string
  icon: LucideIcon
  /** The one dark button; everything else is secondary. */
  primary?: boolean
}

/**
 * The handful of things someone opens this page to start. Each is filtered by the
 * permission that would let the server accept it, so a button never leads to a
 * form that ends in a `403`.
 *
 * Receiving and transfers are the same endpoint from two sides: `transfers.receive`
 * confirms what arrived, `transfers.dispatch` prepares and sends.
 */
function useQuickActions(): Action[] {
  const { can, canDispatchTransfers, canReceiveTransfers } = usePermission()
  const actions: Action[] = []

  if (can('sales.create')) {
    actions.push({ href: '/sales/new', label: 'New sale', icon: ScanLine, primary: true })
  }
  if (canReceiveTransfers()) {
    actions.push({ href: inventoryHubHref('receiving'), label: 'Receive delivery', icon: Truck })
  }
  if (canDispatchTransfers()) {
    actions.push({ href: '/transfers/new', label: 'New transfer', icon: ArrowLeftRight })
  }
  /* Booking a supplier delivery in. Distinct from "Receive delivery" above,
     which confirms a transfer from another branch. one brings stock into the
     business, the other moves stock already in it. */
  if (can('stock.adjust')) {
    actions.push({ href: '/stock-receipts/new', label: 'Receive stock', icon: PackagePlus })
  }
  /* Adding a model was only reachable from Products → Add product. It is a
     daily job when a delivery arrives, so it belongs with the rest. */
  if (can('catalog.create')) {
    actions.push({ href: '/products/new', label: 'Add product', icon: PackageSearch })
  }
  return actions
}

/** Under 768px the row folds into one "+" button, so the title keeps its line. */
function CollapsedActions({ actions }: { actions: Action[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="quick-actions-collapsed">
      <button
        type="button"
        className="btn btn-primary quick-actions-toggle"
        aria-expanded={open}
        aria-label={open ? 'Hide actions' : 'Show actions'}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
      </button>
      {open && (
        <div className="quick-actions-sheet" role="group" aria-label="Quick actions">
          {actions.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="btn btn-secondary" onClick={() => setOpen(false)}>
              <Icon size={16} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export function QuickActions() {
  const actions = useQuickActions()
  if (actions.length === 0) return null

  return (
    <>
      <div className="quick-actions" role="group" aria-label="Quick actions">
        {actions.map(({ href, label, icon: Icon, primary }) => (
          <Link key={href} href={href} className={`btn ${primary ? 'btn-primary' : 'btn-secondary'}`}>
            <Icon size={16} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </div>
      <CollapsedActions actions={actions} />
    </>
  )
}
