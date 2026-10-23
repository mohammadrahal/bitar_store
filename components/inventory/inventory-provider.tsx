'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { createId, nextReference, nextSku } from '@/lib/inventory/ids'
import { inventoryReducer, type InventoryAction } from '@/lib/inventory/reducer'
import { createEmptyState, createSeedState } from '@/lib/inventory/seed'
import {
  ALL_BRANCHES,
  type ActionResult,
  type Branch,
  type BranchScope,
  type BranchType,
  type InventoryState,
  type Movement,
  type Settings,
} from '@/lib/inventory/types'

const STORAGE_KEY = 'bitar-fashion:inventory:v1'
const SCOPE_KEY = 'bitar-fashion:scope'

export interface BranchInput {
  id?: string
  name: string
  code: string
  address: string
  type: BranchType
}

export interface ProductInput {
  id?: string
  sku: string
  name: string
  category: string
  price: number
  reorderPoint: number
  initialStock?: { branchId: string; qty: number }
}

export interface StockInput {
  productId: string
  branchId: string
  type: 'stock_in' | 'stock_out' | 'adjustment'
  /** Units received/sold, or the counted on-hand total for adjustments. */
  qty: number
  reference?: string
  note?: string
}

export interface TransferInput {
  fromBranchId: string
  toBranchId: string
  lines: { productId: string; qty: number }[]
  note?: string
}

interface InventoryContextValue {
  state: InventoryState
  ready: boolean
  scope: BranchScope
  setScope: (scope: BranchScope) => void
  branchName: (id: string | undefined) => string
  saveBranch: (input: BranchInput) => ActionResult
  deleteBranch: (id: string) => ActionResult
  saveProduct: (input: ProductInput) => ActionResult
  deleteProduct: (id: string) => ActionResult
  recordStock: (input: StockInput) => ActionResult
  createTransfer: (input: TransferInput) => ActionResult
  completeTransfer: (movementId: string, status: 'received' | 'cancelled') => ActionResult
  updateSettings: (settings: Settings) => ActionResult
  importData: (raw: string) => ActionResult
  resetToDemo: () => void
  clearAll: () => void
}

const InventoryContext = createContext<InventoryContextValue | null>(null)

const ok: ActionResult = { ok: true }
const fail = (error: string): ActionResult => ({ ok: false, error })

function isInventoryState(value: unknown): value is InventoryState {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    v.version === 1 &&
    Array.isArray(v.branches) &&
    Array.isArray(v.products) &&
    Array.isArray(v.stock) &&
    Array.isArray(v.movements) &&
    typeof v.settings === 'object' &&
    v.settings !== null
  )
}

function loadState(): InventoryState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isInventoryState(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(inventoryReducer, undefined, () => createEmptyState())
  const [ready, setReady] = useState(false)
  const [scope, setScopeState] = useState<BranchScope>(ALL_BRANCHES)
  const stateRef = useRef(state)

  const apply = useCallback((action: InventoryAction) => {
    stateRef.current = inventoryReducer(stateRef.current, action)
    dispatch(action)
  }, [])

  useEffect(() => {
    apply({ type: 'hydrate', state: loadState() ?? createSeedState() })
    const savedScope = window.localStorage.getItem(SCOPE_KEY)
    if (savedScope) setScopeState(savedScope)
    setReady(true)

    function onStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY || !event.newValue) return
      const next = loadState()
      if (next) apply({ type: 'hydrate', state: next })
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [apply])

  useEffect(() => {
    if (!ready) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Storage full or unavailable (private mode); state stays in memory.
    }
  }, [state, ready])

  const validScope = scope === ALL_BRANCHES || state.branches.some((b) => b.id === scope) ? scope : ALL_BRANCHES

  const setScope = useCallback((next: BranchScope) => {
    setScopeState(next)
    window.localStorage.setItem(SCOPE_KEY, next)
  }, [])

  const branchName = useCallback(
    (id: string | undefined) => state.branches.find((b) => b.id === id)?.name ?? 'Deleted branch',
    [state.branches],
  )

  const actions = useMemo(() => {
    const now = () => new Date().toISOString()
    const user = () => stateRef.current.settings.userName || 'Unknown user'

    return {
      saveBranch(input: BranchInput): ActionResult {
        const s = stateRef.current
        const name = input.name.trim()
        const code = input.code.trim().toUpperCase()
        if (!name || !code) return fail('Branch name and code are required.')
        if (s.branches.some((b) => b.id !== input.id && b.code === code)) return fail(`Branch code ${code} is already in use.`)
        if (s.branches.some((b) => b.id !== input.id && b.name.toLowerCase() === name.toLowerCase()))
          return fail(`A branch named “${name}” already exists.`)

        const existing = s.branches.find((b) => b.id === input.id)
        const branch: Branch = {
          id: existing?.id ?? createId('br'),
          name,
          code,
          address: input.address.trim(),
          type: input.type,
          createdAt: existing?.createdAt ?? now(),
        }
        apply({ type: 'branch/upsert', branch })
        return ok
      },

      deleteBranch(id: string): ActionResult {
        const s = stateRef.current
        const units = s.stock.filter((l) => l.branchId === id).reduce((sum, l) => sum + l.onHand, 0)
        if (units > 0) return fail(`This branch still holds ${units} units. Transfer or adjust them out first.`)
        const pending = s.movements.some(
          (m) => m.status === 'in_transit' && (m.branchId === id || m.toBranchId === id),
        )
        if (pending) return fail('This branch has transfers in transit. Receive or cancel them first.')
        apply({ type: 'branch/delete', branchId: id })
        if (scope === id) setScope(ALL_BRANCHES)
        return ok
      },

      saveProduct(input: ProductInput): ActionResult {
        const s = stateRef.current
        const name = input.name.trim()
        const sku = (input.sku.trim() || nextSku(s.products)).toUpperCase()
        if (!name) return fail('Product name is required.')
        if (s.products.some((p) => p.id !== input.id && p.sku === sku)) return fail(`SKU ${sku} is already in use.`)
        if (!(input.price >= 0) || !(input.reorderPoint >= 0)) return fail('Price and reorder point must be zero or more.')

        const existing = s.products.find((p) => p.id === input.id)
        const product = {
          id: existing?.id ?? createId('p'),
          sku,
          name,
          category: input.category.trim() || 'Uncategorized',
          price: input.price,
          reorderPoint: Math.floor(input.reorderPoint),
          createdAt: existing?.createdAt ?? now(),
        }

        if (existing) {
          apply({ type: 'product/update', product })
          return ok
        }

        const initial = input.initialStock
        if (initial && !s.branches.some((b) => b.id === initial.branchId)) return fail('Choose a branch for the opening stock.')
        const qty = initial ? Math.max(0, Math.floor(initial.qty)) : 0
        apply({
          type: 'product/create',
          product,
          initialStock: initial ? { productId: product.id, branchId: initial.branchId, onHand: qty, reserved: 0 } : undefined,
          movement:
            initial && qty > 0
              ? {
                  id: createId('m'),
                  type: 'stock_in',
                  productId: product.id,
                  productName: product.name,
                  sku: product.sku,
                  branchId: initial.branchId,
                  qty,
                  reference: nextReference('PO-', s.movements),
                  note: 'Opening stock',
                  user: user(),
                  createdAt: now(),
                }
              : undefined,
        })
        return ok
      },

      deleteProduct(id: string): ActionResult {
        const s = stateRef.current
        if (s.movements.some((m) => m.productId === id && m.status === 'in_transit'))
          return fail('This product has transfers in transit. Receive or cancel them first.')
        apply({ type: 'product/delete', productId: id })
        return ok
      },

      recordStock(input: StockInput): ActionResult {
        const s = stateRef.current
        const product = s.products.find((p) => p.id === input.productId)
        if (!product) return fail('Choose a product.')
        if (!s.branches.some((b) => b.id === input.branchId)) return fail('Choose a branch.')
        if (!Number.isInteger(input.qty) || input.qty < 0) return fail('Quantity must be a whole number.')

        const level = s.stock.find((l) => l.productId === input.productId && l.branchId === input.branchId)
        const onHand = level?.onHand ?? 0
        let delta: number
        if (input.type === 'stock_in') {
          if (input.qty === 0) return fail('Quantity must be at least 1.')
          delta = input.qty
        } else if (input.type === 'stock_out') {
          if (input.qty === 0) return fail('Quantity must be at least 1.')
          const available = onHand - (level?.reserved ?? 0)
          if (input.qty > available) return fail(`Only ${Math.max(0, available)} units are available at this branch.`)
          delta = -input.qty
        } else {
          delta = input.qty - onHand
          if (delta === 0) return fail('The counted quantity matches what is on hand. Nothing to adjust.')
        }

        const prefix = input.type === 'stock_in' ? 'PO-' : input.type === 'stock_out' ? 'SO-' : 'ADJ-'
        apply({
          type: 'stock/record',
          movement: {
            id: createId('m'),
            type: input.type,
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            branchId: input.branchId,
            qty: delta,
            reference: input.reference?.trim() || nextReference(prefix, s.movements),
            note: input.note?.trim() || undefined,
            user: user(),
            createdAt: now(),
          },
        })
        return ok
      },

      createTransfer(input: TransferInput): ActionResult {
        const s = stateRef.current
        if (input.fromBranchId === input.toBranchId) return fail('Source and destination must be different branches.')
        if (!input.lines.length) return fail('Add at least one product.')
        const ids = new Set<string>()
        for (const line of input.lines) {
          if (ids.has(line.productId)) return fail('Each product can only appear once per transfer.')
          ids.add(line.productId)
          const product = s.products.find((p) => p.id === line.productId)
          if (!product) return fail('Choose a product for every line.')
          if (!Number.isInteger(line.qty) || line.qty <= 0) return fail(`Enter a quantity for ${product.name}.`)
          const level = s.stock.find((l) => l.productId === line.productId && l.branchId === input.fromBranchId)
          const available = (level?.onHand ?? 0) - (level?.reserved ?? 0)
          if (line.qty > available) return fail(`Only ${Math.max(0, available)} units of ${product.name} are available.`)
        }

        const reference = nextReference('TR-', s.movements)
        const createdAt = now()
        const movements: Movement[] = input.lines.map((line) => {
          const product = s.products.find((p) => p.id === line.productId)!
          return {
            id: createId('m'),
            type: 'transfer',
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            branchId: input.fromBranchId,
            toBranchId: input.toBranchId,
            qty: line.qty,
            reference,
            note: input.note?.trim() || undefined,
            user: user(),
            createdAt,
            status: 'in_transit',
          }
        })
        apply({ type: 'transfer/create', movements })
        return ok
      },

      completeTransfer(movementId: string, status: 'received' | 'cancelled'): ActionResult {
        const m = stateRef.current.movements.find((x) => x.id === movementId)
        if (!m || m.status !== 'in_transit') return fail('This transfer is no longer in transit.')
        apply({ type: 'transfer/complete', movementId, status, at: now() })
        return ok
      },

      updateSettings(settings: Settings): ActionResult {
        if (!settings.userName.trim()) return fail('Your name is required.')
        apply({ type: 'settings/update', settings: { ...settings, userName: settings.userName.trim() } })
        return ok
      },

      importData(raw: string): ActionResult {
        try {
          const parsed: unknown = JSON.parse(raw)
          if (!isInventoryState(parsed)) return fail('This file is not a valid Bitar Fashion backup.')
          apply({ type: 'hydrate', state: parsed })
          return ok
        } catch {
          return fail('Could not read the file. Make sure it is a JSON backup.')
        }
      },

      resetToDemo() {
        apply({ type: 'hydrate', state: createSeedState() })
        setScope(ALL_BRANCHES)
      },

      clearAll() {
        apply({ type: 'hydrate', state: createEmptyState(stateRef.current.settings) })
        setScope(ALL_BRANCHES)
      },
    }
  }, [apply, scope, setScope])

  const value = useMemo<InventoryContextValue>(
    () => ({ state, ready, scope: validScope, setScope, branchName, ...actions }),
    [state, ready, validScope, setScope, branchName, actions],
  )

  return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
}

export function useInventory() {
  const ctx = useContext(InventoryContext)
  if (!ctx) throw new Error('useInventory must be used inside <InventoryProvider>')
  return ctx
}
