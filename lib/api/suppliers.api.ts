import type { PageRequestFn, RequestFn } from '@/lib/api/client'
import { queryOf } from '@/lib/api/query'
import type {
  ApiSupplier,
  CreateSupplierInput,
  ListSuppliersParams,
  UpdateSupplierInput,
} from '@/lib/api/types'

/**
 * `/suppliers`: who the warehouse buys from. Admin or manager only.
 *
 * A supplier used to be free text on every goods receipt, which meant the same
 * company was spelled three ways and no screen could total what was bought from
 * it. A receipt now carries `supplierId`, and `GET /goods-receipts?supplierId=`
 * reads the deliveries back.
 *
 * There is no delete: a supplier that is no longer used is deactivated with
 * `PATCH /suppliers/:id { isActive: false }`, so old receipts keep pointing at
 * a record that still resolves.
 */
export function createSuppliersApi(request: RequestFn, pageRequest: PageRequestFn) {
  return {
    listSuppliersPage: (params: ListSuppliersParams = {}) =>
      pageRequest<ApiSupplier>(`/suppliers${queryOf({ ...params })}`),
    getSupplier: (id: string) => request<ApiSupplier>(`/suppliers/${id}`),
    createSupplier: (input: CreateSupplierInput) => request<ApiSupplier>('/suppliers', 'POST', input),
    updateSupplier: (id: string, input: UpdateSupplierInput) =>
      request<ApiSupplier>(`/suppliers/${id}`, 'PATCH', input),
  }
}

export type SuppliersApi = ReturnType<typeof createSuppliersApi>
