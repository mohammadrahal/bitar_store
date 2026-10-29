import { delay, delayedFailure } from '@/lib/delay'
import { createId } from '@/lib/ids'
import { commitDb, readDb } from '@/mocks/store'
import { can } from '@/lib/permissions'
import { useUserStore } from '@/store/user-store'
import type { Supplier } from '@/types'

/*
 * BL-06 suppliers. Name and phone are required, a super admin or manager
 * creates and edits them, and an employee only picks one on a receipt. There is
 * no supplier endpoint, so they live in the local ledger and the screen is
 * marked Preview.
 */

function mayManage(): boolean {
  const user = useUserStore.getState().user
  return Boolean(user && can(user, 'suppliers.manage'))
}

export async function listSuppliers(includeArchived = false): Promise<Supplier[]> {
  const suppliers = readDb()
    .suppliers.filter((supplier) => includeArchived || !supplier.archived)
    .sort((a, b) => a.name.localeCompare(b.name))
  return delay(suppliers)
}

export interface SupplierInput {
  name: string
  phone: string
}

function validate(input: SupplierInput): string | null {
  if (input.name.trim().length < 2) return 'A supplier needs a name of at least 2 characters.'
  if (input.phone.trim().length < 6) return 'A supplier needs a phone number.'
  return null
}

export async function createSupplier(input: SupplierInput): Promise<Supplier> {
  if (!mayManage()) return delayedFailure('Only a super admin or manager can add a supplier.')
  const invalid = validate(input)
  if (invalid) return delayedFailure(invalid)

  const db = readDb()
  if (db.suppliers.some((supplier) => supplier.name.toLowerCase() === input.name.trim().toLowerCase())) {
    return delayedFailure('A supplier with that name already exists.')
  }

  const supplier: Supplier = {
    id: createId('sup'),
    name: input.name.trim(),
    phone: input.phone.trim(),
    archived: false,
    createdAt: new Date().toISOString(),
  }
  db.suppliers.push(supplier)
  commitDb(db)
  return delay(supplier)
}

export async function updateSupplier(supplierId: string, input: SupplierInput): Promise<Supplier> {
  if (!mayManage()) return delayedFailure('Only a super admin or manager can edit a supplier.')
  const invalid = validate(input)
  if (invalid) return delayedFailure(invalid)

  const db = readDb()
  const supplier = db.suppliers.find((candidate) => candidate.id === supplierId)
  if (!supplier) return delayedFailure('That supplier no longer exists.')
  supplier.name = input.name.trim()
  supplier.phone = input.phone.trim()
  commitDb(db)
  return delay(supplier)
}

/** Suppliers are never deleted: confirmed receipts keep pointing at them. */
export async function setSupplierArchived(supplierId: string, archived: boolean): Promise<Supplier> {
  if (!mayManage()) return delayedFailure('Only a super admin or manager can archive a supplier.')
  const db = readDb()
  const supplier = db.suppliers.find((candidate) => candidate.id === supplierId)
  if (!supplier) return delayedFailure('That supplier no longer exists.')
  supplier.archived = archived
  commitDb(db)
  return delay(supplier)
}
