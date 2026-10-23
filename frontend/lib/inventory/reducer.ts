import type { Branch, InventoryState, Movement, Product, Settings, StockLevel } from './types'

export type InventoryAction =
  | { type: 'hydrate'; state: InventoryState }
  | { type: 'branch/upsert'; branch: Branch }
  | { type: 'branch/delete'; branchId: string }
  | { type: 'product/create'; product: Product; initialStock?: StockLevel; movement?: Movement }
  | { type: 'product/update'; product: Product }
  | { type: 'product/delete'; productId: string }
  | { type: 'stock/record'; movement: Movement }
  | { type: 'transfer/create'; movements: Movement[] }
  | { type: 'transfer/complete'; movementId: string; status: 'received' | 'cancelled'; at: string }
  | { type: 'settings/update'; settings: Settings }

function applyDelta(stock: StockLevel[], productId: string, branchId: string, delta: number): StockLevel[] {
  const exists = stock.some((s) => s.productId === productId && s.branchId === branchId)
  if (!exists) return [...stock, { productId, branchId, onHand: Math.max(0, delta), reserved: 0 }]
  return stock.map((s) =>
    s.productId === productId && s.branchId === branchId ? { ...s, onHand: Math.max(0, s.onHand + delta) } : s,
  )
}

export function inventoryReducer(state: InventoryState, action: InventoryAction): InventoryState {
  switch (action.type) {
    case 'hydrate':
      return action.state

    case 'branch/upsert': {
      const exists = state.branches.some((b) => b.id === action.branch.id)
      return {
        ...state,
        branches: exists
          ? state.branches.map((b) => (b.id === action.branch.id ? action.branch : b))
          : [...state.branches, action.branch],
      }
    }

    case 'branch/delete':
      return {
        ...state,
        branches: state.branches.filter((b) => b.id !== action.branchId),
        stock: state.stock.filter((s) => s.branchId !== action.branchId),
      }

    case 'product/create':
      return {
        ...state,
        products: [...state.products, action.product],
        stock: action.initialStock ? [...state.stock, action.initialStock] : state.stock,
        movements: action.movement ? [action.movement, ...state.movements] : state.movements,
      }

    case 'product/update':
      return {
        ...state,
        products: state.products.map((p) => (p.id === action.product.id ? action.product : p)),
      }

    case 'product/delete':
      return {
        ...state,
        products: state.products.filter((p) => p.id !== action.productId),
        stock: state.stock.filter((s) => s.productId !== action.productId),
      }

    case 'stock/record': {
      const m = action.movement
      return {
        ...state,
        stock: applyDelta(state.stock, m.productId, m.branchId, m.qty),
        movements: [m, ...state.movements],
      }
    }

    case 'transfer/create': {
      let stock = state.stock
      for (const m of action.movements) stock = applyDelta(stock, m.productId, m.branchId, -m.qty)
      return { ...state, stock, movements: [...action.movements, ...state.movements] }
    }

    case 'transfer/complete': {
      const m = state.movements.find((x) => x.id === action.movementId)
      if (!m || m.type !== 'transfer' || m.status !== 'in_transit' || !m.toBranchId) return state
      const targetBranch = action.status === 'received' ? m.toBranchId : m.branchId
      return {
        ...state,
        stock: applyDelta(state.stock, m.productId, targetBranch, m.qty),
        movements: state.movements.map((x) =>
          x.id === m.id ? { ...x, status: action.status, completedAt: action.at } : x,
        ),
      }
    }

    case 'settings/update':
      return { ...state, settings: action.settings }
  }
}
