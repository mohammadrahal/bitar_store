import type { RequestFn } from '@/lib/api/client'
import { queryOf } from '@/lib/api/query'
import type {
  ApiBarcode,
  ApiPriceChange,
  ApiSku,
  ApiSkuDetail,
  ApiSkuWithStyle,
  ApiStyle,
  ApiStyleDetail,
  CatalogListParams,
  CreateSkuInput,
  CreateStyleInput,
  SkuListParams,
  UpdateSkuInput,
  UpdateStyleInput,
} from '@/lib/api/types'

export function createCatalogApi(request: RequestFn) {
  return {
    listStyles: (params: CatalogListParams = {}) => request<ApiStyle[]>(`/styles${queryOf({ ...params })}`),
    getStyle: (id: string) => request<ApiStyleDetail>(`/styles/${id}`),
    createStyle: (input: CreateStyleInput) => request<ApiStyle>('/styles', 'POST', input),
    updateStyle: (id: string, changes: UpdateStyleInput) => request<ApiStyle>(`/styles/${id}`, 'PATCH', changes),

    listSkus: (params: SkuListParams = {}) => request<ApiSkuWithStyle[]>(`/skus${queryOf({ ...params })}`),
    /** Exact barcode first, then exact SKU code: what a scanner sends. */
    lookupSku: (code: string) => request<ApiSkuDetail>(`/skus/lookup${queryOf({ code })}`),
    getSku: (id: string) => request<ApiSkuDetail>(`/skus/${id}`),
    createSku: (input: CreateSkuInput) => request<ApiSku>('/skus', 'POST', input),
    updateSku: (id: string, changes: UpdateSkuInput) => request<ApiSku>(`/skus/${id}`, 'PATCH', changes),
    setSkuPrice: (id: string, price: string | number) => request<ApiSku>(`/skus/${id}/price`, 'PUT', { price }),
    changeSkuPrice: (id: string, price: string | number) => request<ApiSku>(`/skus/${id}/price`, 'PUT', { price }),
    getPriceHistory: (id: string, limit?: number) =>
      request<ApiPriceChange[]>(`/skus/${id}/price-history${queryOf({ limit })}`),

    addBarcode: (skuId: string, code: string) => request<ApiBarcode>(`/skus/${skuId}/barcodes`, 'POST', { code }),
    deleteBarcode: (id: string) => request<void>(`/barcodes/${id}`, 'DELETE'),
    deleteStyle: (id: string) => request<void>(`/styles/${id}`, 'DELETE'),
    deleteSku: (id: string) => request<void>(`/skus/${id}`, 'DELETE'),
  }
}

export type CatalogApi = ReturnType<typeof createCatalogApi>
