'use client'

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { ConfirmDialog, type ConfirmOptions } from '@/components/dashboard/confirm-dialog'
import { BranchForm } from '@/components/forms/branch-form'
import { ProductForm } from '@/components/forms/product-form'
import { StockForm } from '@/components/forms/stock-form'
import { TransferForm } from '@/components/forms/transfer-form'
import type { StockInput } from '@/components/inventory/inventory-provider'

export type DrawerRequest =
  | { kind: 'product'; productId?: string }
  | { kind: 'branch'; branchId?: string }
  | { kind: 'stock'; productId?: string; branchId?: string; mode?: StockInput['type'] }
  | { kind: 'transfer'; productId?: string; fromBranchId?: string }

interface DashboardUIValue {
  openDrawer: (request: DrawerRequest) => void
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const DashboardUIContext = createContext<DashboardUIValue | null>(null)

export function DashboardUIProvider({ children }: { children: React.ReactNode }) {
  const [drawer, setDrawer] = useState<DrawerRequest | null>(null)
  const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback((options: ConfirmOptions) => {
    resolver.current?.(false)
    setConfirmState(options)
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
    })
  }, [])

  const resolveConfirm = useCallback((value: boolean) => {
    resolver.current?.(value)
    resolver.current = null
    setConfirmState(null)
  }, [])

  const value = useMemo(() => ({ openDrawer: setDrawer, confirm }), [confirm])
  const close = useCallback(() => setDrawer(null), [])

  return (
    <DashboardUIContext.Provider value={value}>
      {children}
      {drawer?.kind === 'product' && <ProductForm key={drawer.productId ?? 'new'} productId={drawer.productId} onClose={close} />}
      {drawer?.kind === 'branch' && <BranchForm key={drawer.branchId ?? 'new'} branchId={drawer.branchId} onClose={close} />}
      {drawer?.kind === 'stock' && <StockForm productId={drawer.productId} branchId={drawer.branchId} mode={drawer.mode} onClose={close} />}
      {drawer?.kind === 'transfer' && <TransferForm productId={drawer.productId} fromBranchId={drawer.fromBranchId} onClose={close} />}
      {confirmState && <ConfirmDialog {...confirmState} onResolve={resolveConfirm} />}
    </DashboardUIContext.Provider>
  )
}

export function useDashboardUI() {
  const ctx = useContext(DashboardUIContext)
  if (!ctx) throw new Error('useDashboardUI must be used inside <DashboardUIProvider>')
  return ctx
}
