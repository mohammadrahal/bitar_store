import type { RequestFn } from '@/lib/api/client'
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

function queryOf(params: Record<string, string | number | boolean | undefined>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value))
  }
  const text = query.toString()
  return text ? `?${text}` : ''
}

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
    setSkuPrice: (id: string, price: string) => request<ApiSku>(`/skus/${id}/price`, 'PUT', { price }),
    getPriceHistory: (id: string, limit?: number) =>
      request<ApiPriceChange[]>(`/skus/${id}/price-history${queryOf({ limit })}`),

    addBarcode: (skuId: string, code: string) => request<ApiBarcode>(`/skus/${skuId}/barcodes`, 'POST', { code }),
    deleteBarcode: (id: string) => request<void>(`/barcodes/${id}`, 'DELETE'),
  }
}

export type CatalogApi = ReturnType<typeof createCatalogApi>
