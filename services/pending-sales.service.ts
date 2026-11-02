import { readPersistentJson, writePersistentJson } from '@/lib/session-storage'

/** Till cart saved on this device until payment posts with `POST /sales`. */
export interface PendingSaleLine {
  skuId: string
  label: string
  quantity: number
  unitPrice: number
}

export interface PendingSale {
  id: string
  branchId: string
  note: string
  createdAt: string
  lines: PendingSaleLine[]
}

const STORAGE_KEY = 'bitar:pending-sales:v1'
const LEGACY_KEY = 'bitar:pending-invoices:v1'

function readAll(): PendingSale[] {
  const current = readPersistentJson<PendingSale[]>(STORAGE_KEY, [])
  if (current.length > 0) return current
  const legacy = readPersistentJson<PendingSale[]>(LEGACY_KEY, [])
  if (legacy.length > 0) {
    writePersistentJson(STORAGE_KEY, legacy)
    return legacy
  }
  return []
}

function writeAll(sales: PendingSale[]) {
  writePersistentJson(STORAGE_KEY, sales)
}

export function listPendingSales(branchId?: string): PendingSale[] {
  const all = readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  if (!branchId) return all
  return all.filter((sale) => sale.branchId === branchId)
}

export function getPendingSale(id: string): PendingSale | undefined {
  return readAll().find((sale) => sale.id === id)
}

export function savePendingSale(input: Omit<PendingSale, 'id' | 'createdAt'> & { id?: string }): PendingSale {
  const all = readAll()
  const createdAt = new Date().toISOString()
  const sale: PendingSale = {
    id: input.id ?? crypto.randomUUID(),
    branchId: input.branchId,
    note: input.note,
    createdAt: input.id ? (all.find((row) => row.id === input.id)?.createdAt ?? createdAt) : createdAt,
    lines: input.lines,
  }
  const next = all.filter((row) => row.id !== sale.id)
  next.unshift(sale)
  writeAll(next)
  return sale
}

export function deletePendingSale(id: string): void {
  writeAll(readAll().filter((sale) => sale.id !== id))
}

export function pendingSaleTotal(sale: PendingSale): number {
  return sale.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
}
