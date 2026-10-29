'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-keys'
import {
  cancelReceipt,
  confirmReceipt,
  correctReceipt,
  createReceiptDraft,
  getReceipt,
  listReceipts,
  updateReceiptDraft,
  type CorrectionInput,
  type ReceiptInput,
} from '@/services/receipts.service'
import {
  createSupplier,
  listSuppliers,
  setSupplierArchived,
  updateSupplier,
  type SupplierInput,
} from '@/services/suppliers.service'
import type { ReceiptStatus } from '@/types'

export function useSuppliers(includeArchived = false) {
  return useQuery({
    queryKey: queryKeys.suppliers.list(includeArchived),
    queryFn: () => listSuppliers(includeArchived),
  })
}

function useSupplierCallbacks(message: (name: string) => string) {
  const queryClient = useQueryClient()
  return {
    onSuccess: (supplier: { name: string }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.suppliers.all })
      toast.success(message(supplier.name))
    },
    onError: (error: Error) => toast.error(error.message),
  }
}

export function useCreateSupplier() {
  return useMutation({
    mutationFn: (input: SupplierInput) => createSupplier(input),
    ...useSupplierCallbacks((name) => `${name} added`),
  })
}

export function useUpdateSupplier() {
  return useMutation({
    mutationFn: ({ id, ...input }: SupplierInput & { id: string }) => updateSupplier(id, input),
    ...useSupplierCallbacks((name) => `${name} updated`),
  })
}

export function useSetSupplierArchived() {
  return useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) => setSupplierArchived(id, archived),
    ...useSupplierCallbacks((name) => `${name} saved`),
  })
}

export function useReceipts(status: ReceiptStatus | 'all' = 'all') {
  return useQuery({
    queryKey: queryKeys.receipts.list(status),
    queryFn: () => listReceipts(status),
  })
}

export function useReceipt(receiptId: string) {
  return useQuery({
    queryKey: queryKeys.receipts.detail(receiptId),
    queryFn: () => getReceipt(receiptId),
    enabled: Boolean(receiptId),
  })
}

function useReceiptCallbacks(message: (number: string) => string) {
  const queryClient = useQueryClient()
  return {
    onSuccess: (receipt: { number: string }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.receipts.all })
      /* A confirmed receipt is what gives a variant its cost. */
      void queryClient.invalidateQueries({ queryKey: queryKeys.products.all })
      toast.success(message(receipt.number))
    },
    onError: (error: Error) => toast.error(error.message),
  }
}

export function useCreateReceipt() {
  return useMutation({
    mutationFn: (input: ReceiptInput) => createReceiptDraft(input),
    ...useReceiptCallbacks((number) => `${number} saved as a draft`),
  })
}

export function useUpdateReceipt() {
  return useMutation({
    mutationFn: ({ id, ...input }: ReceiptInput & { id: string }) => updateReceiptDraft(id, input),
    ...useReceiptCallbacks((number) => `${number} updated`),
  })
}

export function useConfirmReceipt() {
  return useMutation({
    mutationFn: (receiptId: string) => confirmReceipt(receiptId),
    ...useReceiptCallbacks((number) => `${number} confirmed`),
  })
}

export function useCancelReceipt() {
  return useMutation({
    mutationFn: (receiptId: string) => cancelReceipt(receiptId),
    ...useReceiptCallbacks((number) => `${number} cancelled`),
  })
}

export function useCorrectReceipt() {
  return useMutation({
    mutationFn: ({ id, ...input }: CorrectionInput & { id: string }) => correctReceipt(id, input),
    ...useReceiptCallbacks((number) => `${number} raised as a correction`),
  })
}
