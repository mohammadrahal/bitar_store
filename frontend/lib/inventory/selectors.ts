import { ALL_BRANCHES, type BranchScope, type InventoryState, type Movement, type Product, type StockLevel, type StockStatus } from './types'

const DAY = 24 * 60 * 60 * 1000

export function levelStatus(onHand: number, reorderPoint: number): StockStatus {
  if (onHand <= 0) return 'out'
  if (onHand < reorderPoint) return 'low'
  return 'healthy'
}

export function inScope(scope: BranchScope, branchId: string) {
  return scope === ALL_BRANCHES || scope === branchId
}

export interface ProductRow extends Product {
  onHand: number
  reserved: number
  available: number
  value: number
  status: StockStatus
  levels: StockLevel[]
}

export function selectProductRows(state: InventoryState, scope: BranchScope): ProductRow[] {
  const rows: ProductRow[] = []
  for (const product of state.products) {
    const levels = state.stock.filter((s) => s.productId === product.id && inScope(scope, s.branchId))
    if (scope !== ALL_BRANCHES && levels.length === 0) continue

    const onHand = levels.reduce((sum, l) => sum + l.onHand, 0)
    const reserved = levels.reduce((sum, l) => sum + l.reserved, 0)
    const anyLow = levels.some((l) => levelStatus(l.onHand, product.reorderPoint) !== 'healthy')
    const status: StockStatus = onHand <= 0 ? 'out' : anyLow ? 'low' : 'healthy'

    rows.push({
      ...product,
      onHand,
      reserved,
      available: Math.max(0, onHand - reserved),
      value: onHand * product.price,
      status,
      levels,
    })
  }
  return rows
}

export interface StockAlert {
  productId: string
  productName: string
  sku: string
  branchId: string
  onHand: number
  reorderPoint: number
  status: Exclude<StockStatus, 'healthy'>
}

export function selectStockAlerts(state: InventoryState, scope: BranchScope): StockAlert[] {
  const alerts: StockAlert[] = []
  for (const level of state.stock) {
    if (!inScope(scope, level.branchId)) continue
    const product = state.products.find((p) => p.id === level.productId)
    if (!product) continue
    const status = levelStatus(level.onHand, product.reorderPoint)
    if (status === 'healthy') continue
    alerts.push({
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      branchId: level.branchId,
      onHand: level.onHand,
      reorderPoint: product.reorderPoint,
      status,
    })
  }
  return alerts.sort((a, b) => (a.status === b.status ? a.onHand - b.onHand : a.status === 'out' ? -1 : 1))
}

export function isMovementInScope(m: Movement, scope: BranchScope) {
  return inScope(scope, m.branchId) || (m.toBranchId !== undefined && inScope(scope, m.toBranchId))
}

export function selectInTransit(state: InventoryState, scope: BranchScope) {
  return state.movements.filter((m) => m.type === 'transfer' && m.status === 'in_transit' && isMovementInScope(m, scope))
}

export function selectStats(state: InventoryState, scope: BranchScope) {
  const rows = selectProductRows(state, scope)
  const alerts = selectStockAlerts(state, scope)
  return {
    value: rows.reduce((sum, r) => sum + r.value, 0),
    units: rows.reduce((sum, r) => sum + r.onHand, 0),
    skuCount: rows.length,
    lowCount: alerts.filter((a) => a.status === 'low').length,
    outCount: alerts.filter((a) => a.status === 'out').length,
    inTransit: selectInTransit(state, scope).length,
  }
}

export interface ActivityPoint {
  date: Date
  inbound: number
  outbound: number
}

/** Daily inbound vs outbound units. Transfers only count when they cross the scope boundary. */
export function selectActivitySeries(movements: Movement[], scope: BranchScope, days: number, now = Date.now()): ActivityPoint[] {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setTime(start.getTime() - (days - 1) * DAY)

  const points: ActivityPoint[] = Array.from({ length: days }, (_, i) => ({
    date: new Date(start.getTime() + i * DAY),
    inbound: 0,
    outbound: 0,
  }))

  for (const m of movements) {
    const index = Math.floor((new Date(m.createdAt).getTime() - start.getTime()) / DAY)
    if (index < 0 || index >= days) continue
    const point = points[index]

    if (m.type === 'transfer') {
      if (scope === ALL_BRANCHES || m.status === 'cancelled') continue
      if (m.branchId === scope) point.outbound += m.qty
      if (m.toBranchId === scope && m.status === 'received') point.inbound += m.qty
      continue
    }
    if (!inScope(scope, m.branchId)) continue
    if (m.qty >= 0) point.inbound += m.qty
    else point.outbound += -m.qty
  }
  return points
}

export function movementDelta(m: Movement, scope: BranchScope) {
  if (m.type !== 'transfer') return m.qty
  if (scope !== ALL_BRANCHES && m.toBranchId === scope) return m.qty
  return -m.qty
}

export function selectCategories(products: Product[]) {
  return Array.from(new Set(products.map((p) => p.category))).sort((a, b) => a.localeCompare(b))
}
