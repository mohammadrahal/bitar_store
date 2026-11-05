'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ApiError } from '@/lib/api/api-error'
import { invalidateStockQueries } from '@/lib/invalidate-stock'
import { queryKeys } from '@/lib/query-keys'
import {
  getGoodsReceipt,
  listGoodsReceipts,
  postGoodsReceipt,
  type GoodsReceiptDraft,
  type PostedGoodsReceipt,
} from '@/services/goods-receipts.service'

export const GOODS_RECEIPTS_PAGE = 20

/** `GET /goods-receipts` — every supplier delivery, newest first. */
export function useGoodsReceipts(search: string, offset: number) {
  return useQuery({
    queryKey: queryKeys.stock.goodsReceipts(search, offset),
    queryFn: () =>
      listGoodsReceipts({
        supplier: search.trim() || undefined,
        limit: GOODS_RECEIPTS_PAGE,
        offset,
      }),
    staleTime: 30_000,
  })
}

export function useGoodsReceipt(id: string) {
  return useQuery({
    queryKey: queryKeys.stock.goodsReceipt(id),
    queryFn: () => getGoodsReceipt(id),
    enabled: Boolean(id),
  })
}

/**
 * The server answers `409` for a supplier invoice number already used by that
 * supplier, and the message names the receipt it was used on. Showing it as it
 * came is the whole point: "that invoice is already receipt GR-00000007" tells
 * the person what to do, where a generic failure would send them to re-type it.
 */
export function usePostGoodsReceipt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (draft: GoodsReceiptDraft) => postGoodsReceipt(draft),
    onSuccess: ({ receipt, photo }: PostedGoodsReceipt) => {
      void queryClient.invalidateQueries({ queryKey: ['stock', 'goods-receipts'] })
      void queryClient.invalidateQueries({ queryKey: ['stock', 'adjustments'] })
      invalidateStockQueries(queryClient)

      const units = receipt.totalQuantity
      toast.success(
        `${receipt.reference}: ${units} ${units === 1 ? 'piece' : 'pieces'} received into ${receipt.warehouse.name}`,
      )
      /* The stock landed either way, so a lost photograph is a note and not a
         failure — but it is never silent. */
      if (photo && !photo.stored) {
        toast.warning('The invoice photo could not be saved in this browser. The delivery itself was recorded.')
      }
    },
    onError: (error: Error) => {
      const duplicate = error instanceof ApiError && error.status === 409
      toast.error(error.message, duplicate ? { duration: 8000 } : undefined)
    },
  })
}
