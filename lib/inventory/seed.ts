import type { Branch, InventoryState, Movement, Product, StockLevel } from './types'

const DAY = 24 * 60 * 60 * 1000

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const branches: Omit<Branch, 'createdAt'>[] = [
  { id: 'br_npt', name: 'Northpoint Store', code: 'NPT-01', address: '12 Market Street', type: 'store' },
  { id: 'br_wst', name: 'Westside Store', code: 'WST-02', address: '88 West Avenue', type: 'store' },
  { id: 'br_hrb', name: 'Harbor Warehouse', code: 'HRB-WH', address: '5 Dock Road', type: 'warehouse' },
]

const products: Omit<Product, 'createdAt'>[] = [
  { id: 'p_01', sku: 'SKU-10398', name: 'Trail Cap', category: 'Accessories', price: 24, reorderPoint: 20 },
  { id: 'p_02', sku: 'SKU-10442', name: 'Cloud Knit Hoodie', category: 'Apparel', price: 68, reorderPoint: 30 },
  { id: 'p_03', sku: 'SKU-10461', name: 'Transit Backpack 18L', category: 'Accessories', price: 89, reorderPoint: 24 },
  { id: 'p_04', sku: 'SKU-10479', name: 'Everyday Cotton Tee', category: 'Apparel', price: 22, reorderPoint: 48 },
  { id: 'p_05', sku: 'SKU-10482', name: 'Core Runner 2.0', category: 'Footwear', price: 120, reorderPoint: 60 },
  { id: 'p_06', sku: 'SKU-10503', name: 'Silk Evening Dress', category: 'Apparel', price: 210, reorderPoint: 8 },
  { id: 'p_07', sku: 'SKU-10517', name: 'Tailored Wool Blazer', category: 'Apparel', price: 245, reorderPoint: 10 },
  { id: 'p_08', sku: 'SKU-10522', name: 'Leather Chelsea Boot', category: 'Footwear', price: 175, reorderPoint: 12 },
  { id: 'p_09', sku: 'SKU-10536', name: 'Linen Wide-Leg Trouser', category: 'Apparel', price: 79, reorderPoint: 18 },
  { id: 'p_10', sku: 'SKU-10541', name: 'Woven Leather Belt', category: 'Accessories', price: 45, reorderPoint: 15 },
]

const stock: StockLevel[] = [
  { productId: 'p_01', branchId: 'br_npt', onHand: 18, reserved: 4 },
  { productId: 'p_01', branchId: 'br_hrb', onHand: 140, reserved: 0 },
  { productId: 'p_02', branchId: 'br_wst', onHand: 86, reserved: 12 },
  { productId: 'p_02', branchId: 'br_npt', onHand: 41, reserved: 3 },
  { productId: 'p_03', branchId: 'br_wst', onHand: 0, reserved: 0 },
  { productId: 'p_03', branchId: 'br_hrb', onHand: 62, reserved: 0 },
  { productId: 'p_04', branchId: 'br_npt', onHand: 42, reserved: 8 },
  { productId: 'p_04', branchId: 'br_wst', onHand: 75, reserved: 5 },
  { productId: 'p_04', branchId: 'br_hrb', onHand: 320, reserved: 40 },
  { productId: 'p_05', branchId: 'br_hrb', onHand: 248, reserved: 31 },
  { productId: 'p_05', branchId: 'br_npt', onHand: 64, reserved: 6 },
  { productId: 'p_06', branchId: 'br_npt', onHand: 6, reserved: 1 },
  { productId: 'p_06', branchId: 'br_wst', onHand: 14, reserved: 2 },
  { productId: 'p_07', branchId: 'br_wst', onHand: 22, reserved: 0 },
  { productId: 'p_07', branchId: 'br_hrb', onHand: 45, reserved: 5 },
  { productId: 'p_08', branchId: 'br_npt', onHand: 0, reserved: 0 },
  { productId: 'p_08', branchId: 'br_hrb', onHand: 38, reserved: 0 },
  { productId: 'p_09', branchId: 'br_wst', onHand: 27, reserved: 4 },
  { productId: 'p_10', branchId: 'br_npt', onHand: 33, reserved: 0 },
  { productId: 'p_10', branchId: 'br_wst', onHand: 9, reserved: 0 },
]

const users = ['Maya Chen', 'Owen Wright', 'System']

export function createSeedState(now = Date.now()): InventoryState {
  const rand = mulberry32(42)
  const pick = <T,>(items: T[]) => items[Math.floor(rand() * items.length)]
  const createdAt = new Date(now - 120 * DAY).toISOString()

  const counters = { 'PO-': 2800, 'SO-': 7800, 'TR-': 180, 'ADJ-': 900 }
  const ref = (prefix: keyof typeof counters) => `${prefix}${String(++counters[prefix]).padStart(4, '0')}`

  const movements: Movement[] = []
  for (let day = 29; day >= 0; day--) {
    const perDay = 1 + Math.floor(rand() * 4)
    for (let i = 0; i < perDay; i++) {
      const level = pick(stock)
      const product = products.find((p) => p.id === level.productId)!
      const at = new Date(now - day * DAY - Math.floor(rand() * 9) * 60 * 60 * 1000).toISOString()
      const roll = rand()
      const base = { productId: product.id, productName: product.name, sku: product.sku, createdAt: at, user: pick(users) }

      if (roll < 0.35) {
        movements.push({ ...base, id: `m_s${movements.length}`, type: 'stock_in', branchId: level.branchId, qty: 20 + Math.floor(rand() * 120), reference: ref('PO-') })
      } else if (roll < 0.8) {
        movements.push({ ...base, id: `m_s${movements.length}`, type: 'stock_out', branchId: level.branchId, qty: -(2 + Math.floor(rand() * 40)), reference: ref('SO-'), user: 'System' })
      } else if (roll < 0.92) {
        const to = pick(branches.filter((b) => b.id !== level.branchId))
        movements.push({ ...base, id: `m_s${movements.length}`, type: 'transfer', branchId: level.branchId, toBranchId: to.id, qty: 6 + Math.floor(rand() * 30), reference: ref('TR-'), status: 'received', completedAt: at })
      } else {
        movements.push({ ...base, id: `m_s${movements.length}`, type: 'adjustment', branchId: level.branchId, qty: Math.floor(rand() * 9) - 4 || 2, reference: ref('ADJ-'), note: 'Cycle count' })
      }
    }
  }

  movements.push(
    {
      id: 'm_transit_1',
      type: 'transfer',
      productId: 'p_03',
      productName: 'Transit Backpack 18L',
      sku: 'SKU-10461',
      branchId: 'br_hrb',
      toBranchId: 'br_wst',
      qty: 24,
      reference: ref('TR-'),
      note: 'Restock for weekend promotion',
      user: 'Maya Chen',
      createdAt: new Date(now - 3 * 60 * 60 * 1000).toISOString(),
      status: 'in_transit',
    },
    {
      id: 'm_transit_2',
      type: 'transfer',
      productId: 'p_08',
      productName: 'Leather Chelsea Boot',
      sku: 'SKU-10522',
      branchId: 'br_hrb',
      toBranchId: 'br_npt',
      qty: 12,
      reference: ref('TR-'),
      user: 'Owen Wright',
      createdAt: new Date(now - 26 * 60 * 60 * 1000).toISOString(),
      status: 'in_transit',
    },
  )

  movements.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return {
    version: 1,
    branches: branches.map((b) => ({ ...b, createdAt })),
    products: products.map((p) => ({ ...p, createdAt })),
    stock: stock.map((s) => ({ ...s })),
    movements,
    settings: { userName: 'Maya Chen', currency: 'USD' },
  }
}

export function createEmptyState(settings?: InventoryState['settings']): InventoryState {
  return {
    version: 1,
    branches: [],
    products: [],
    stock: [],
    movements: [],
    settings: settings ?? { userName: 'Maya Chen', currency: 'USD' },
  }
}
