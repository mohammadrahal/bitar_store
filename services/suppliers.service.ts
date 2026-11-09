import { getApiClient } from '@/lib/api'
import type {
  ApiSupplier,
  CreateSupplierInput,
  ListSuppliersParams,
  UpdateSupplierInput,
} from '@/lib/api/types'

/**
 * `/suppliers`: the companies the warehouse buys from. Admin or manager only.
 *
 * Before this existed a supplier was free text on each goods receipt, so the
 * same company arrived spelled three ways and nothing could total a year of
 * deliveries from it. A receipt now carries `supplierId`, while `supplierName`
 * on the receipt stays the name **as of that day**.
 *
 * A supplier is never deleted. One that is no longer used is deactivated, so
 * old receipts keep resolving.
 */

export async function listSuppliers(params: ListSuppliersParams = {}) {
  return getApiClient().listSuppliersPage({ limit: 50, ...params })
}

/** The picker on the goods-receipt form: active suppliers only, by name. */
export async function listActiveSuppliers(search = ''): Promise<ApiSupplier[]> {
  const { items } = await listSuppliers({ active: true, search: search.trim() || undefined, limit: 200 })
  return [...items].sort((a, b) => a.name.localeCompare(b.name))
}

export async function getSupplier(id: string): Promise<ApiSupplier> {
  return getApiClient().getSupplier(id)
}

/** The first thing wrong with the form, in the words it will show. */
export function validateSupplier(input: { name: string; phone: string }): string | null {
  if (!input.name.trim()) return 'Enter the supplier’s name.'
  if (!input.phone.trim()) return 'Enter a phone number for the supplier.'
  return null
}

export async function createSupplier(input: CreateSupplierInput): Promise<ApiSupplier> {
  const problem = validateSupplier(input)
  if (problem) throw new Error(problem)
  return getApiClient().createSupplier({
    name: input.name.trim(),
    phone: input.phone.trim(),
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
  })
}

export async function updateSupplier(id: string, input: UpdateSupplierInput): Promise<ApiSupplier> {
  return getApiClient().updateSupplier(id, input)
}

/** Switch a supplier off without touching the receipts that name it. */
export async function deactivateSupplier(id: string): Promise<ApiSupplier> {
  return updateSupplier(id, { isActive: false })
}

export async function reactivateSupplier(id: string): Promise<ApiSupplier> {
  return updateSupplier(id, { isActive: true })
}

export type { ApiSupplier }
