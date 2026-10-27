'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useMirroredBranches } from '@/hooks/use-stock'
import { queryKeys, type InvoiceFilters } from '@/lib/query-keys'
import {
  createInvoice,
  deleteInvoice,
  getInvoice,
  issueInvoice,
  listInvoices,
  listInvoicesByProduct,
  markInvoicePaid,
  updateInvoice,
  voidInvoice,
  type InvoiceInput,
} from '@/services/invoices.service'
import { searchVariants } from '@/services/products.service'
import { getBranchStockMap } from '@/services/stock.service'

export function useInvoices(filters: InvoiceFilters) {
  const mirrored = useMirroredBranches()
  return useQuery({
    queryKey: queryKeys.invoices.list(filters),
    queryFn: () => listInvoices(filters),
    enabled: mirrored !== null,
  })
}

export function useInvoice(invoiceId: string) {
  return useQuery({
    queryKey: queryKeys.invoices.detail(invoiceId),
    queryFn: () => getInvoice(invoiceId),
    enabled: Boolean(invoiceId),
  })
}

export function useProductInvoices(productId: string) {
  return useQuery({
    queryKey: queryKeys.invoices.byProduct(productId),
    queryFn: () => listInvoicesByProduct(productId),
    enabled: Boolean(productId),
  })
}

/** Catalog variants for the line picker, narrowed by what has been typed. */
export function useVariantSearch(search: string) {
  return useQuery({
    queryKey: queryKeys.products.variants(search),
    queryFn: () => searchVariants(search),
  })
}

/** On-hand quantities at the document's branch, so the form can warn early. */
export function useBranchStock(branchId: string) {
  return useQuery({
    queryKey: queryKeys.stock.onHand(branchId),
    queryFn: () => getBranchStockMap(branchId),
    enabled: Boolean(branchId),
  })
}

/** Posting a document moves stock, so both domains are invalidated together. */
function useInvoiceMutationCallbacks() {
  const queryClient = useQueryClient()
  return {
    invalidate: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.stock.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.all })
    },
    reportError: (error: Error) => toast.error(error.message),
  }
}

export function useCreateInvoice() {
  const { invalidate, reportError } = useInvoiceMutationCallbacks()
  return useMutation({
    mutationFn: ({ input, issue, key }: { input: InvoiceInput; issue: boolean; key?: string }) =>
      createInvoice(input, issue, key),
    onSuccess: (invoice) => {
      invalidate()
      if (invoice.status === 'draft') toast.success(`${invoice.number} saved as a draft`)
      else if (invoice.kind === 'sale') toast.success(`Sale confirmed: ${invoice.number}`)
      else toast.success(`${invoice.number} issued`)
    },
    onError: reportError,
  })
}

export function useUpdateInvoice() {
  const { invalidate, reportError } = useInvoiceMutationCallbacks()
  return useMutation({
    mutationFn: ({ invoiceId, input }: { invoiceId: string; input: InvoiceInput }) => updateInvoice(invoiceId, input),
    onSuccess: (invoice) => {
      invalidate()
      toast.success(`${invoice.number} updated`)
    },
    onError: reportError,
  })
}

export function useIssueInvoice() {
  const { invalidate, reportError } = useInvoiceMutationCallbacks()
  return useMutation({
    mutationFn: ({ invoiceId }: { invoiceId: string }) => issueInvoice(invoiceId),
    onSuccess: (invoice) => {
      invalidate()
      toast.success(`${invoice.number} issued and stock updated`)
    },
    onError: reportError,
  })
}

export function useMarkInvoicePaid() {
  const { invalidate, reportError } = useInvoiceMutationCallbacks()
  return useMutation({
    mutationFn: ({ invoiceId }: { invoiceId: string }) => markInvoicePaid(invoiceId),
    onSuccess: (invoice) => {
      invalidate()
      toast.success(`${invoice.number} marked paid`)
    },
    onError: reportError,
  })
}

export function useVoidInvoice() {
  const { invalidate, reportError } = useInvoiceMutationCallbacks()
  return useMutation({
    mutationFn: ({ invoiceId }: { invoiceId: string }) => voidInvoice(invoiceId),
    onSuccess: (invoice) => {
      invalidate()
      toast.warning(`${invoice.number} voided and stock given back`)
    },
    onError: reportError,
  })
}

export function useDeleteInvoice() {
  const { invalidate, reportError } = useInvoiceMutationCallbacks()
  return useMutation({
    mutationFn: ({ invoiceId }: { invoiceId: string; number: string }) => deleteInvoice(invoiceId),
    onSuccess: (_result, { number }) => {
      invalidate()
      toast.warning(`${number} deleted`)
    },
    onError: reportError,
  })
}
