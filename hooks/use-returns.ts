'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { priceOf } from '@/lib/api/map-catalog'
import { formatPrice } from '@/lib/format'
import { queryKeys } from '@/lib/query-keys'
import { messageOf } from '@/lib/errors'
import {
  approveReturn,
  findReturnableSale,
  getReturn,
  handbackReturn,
  linkReturnExchange,
  listReturns,
  payReturnRefund,
  receiveReturn,
  rejectReturn,
  releaseReturn,
  takeReturnCustody,
  type ReceiveReturnDraft,
} from '@/services/returns.service'
import type { ApiReturn, ApiReturnStatus } from '@/lib/api/types'

/**
 * Customer returns, over `/returns`.
 *
 * Every write answers with the whole return, so each mutation seeds the detail
 * cache and then invalidates the list. Three other things move with a return
 * and are invalidated too, which is easy to forget and wrong to skip:
 *
 * - **stock**, because approval and release move units between buckets;
 * - **the cash drawer**, because a cash refund comes out of it;
 * - **the reports**, because `refunds` and `netRevenue` change.
 */
async function invalidateReturn(client: ReturnType<typeof useQueryClient>, entry: ApiReturn) {
  client.setQueryData(queryKeys.returns.detail(entry.id), entry)
  await Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.returns.all }),
    client.invalidateQueries({ queryKey: queryKeys.stock.all }),
    client.invalidateQueries({ queryKey: queryKeys.cashSessions.all }),
    client.invalidateQueries({ queryKey: queryKeys.reports.all }),
  ])
}

/**
 * The sale a return starts from, looked up by receipt number or id.
 *
 * `null` means no such sale — the usual outcome of a half-typed number, so it
 * is an empty result and not an error. Nothing is sent for a key under three
 * characters, which the server would refuse anyway.
 */
export function useReturnableSale(saleKey: string, enabled = true) {
  const key = saleKey.trim()
  return useQuery({
    queryKey: queryKeys.returns.eligible(key),
    queryFn: () => findReturnableSale(key),
    enabled: enabled && key.length >= 3,
    /* What is returnable changes as soon as anyone else takes something back,
       and two counters sharing a receipt is exactly the race this guards. */
    staleTime: 10_000,
  })
}

export interface ReturnsListQuery {
  branchId?: string
  saleId?: string
  status?: ApiReturnStatus
  offset?: number
}

export function useReturns(query: ReturnsListQuery = {}, enabled = true) {
  const { branchId = '', saleId = '', status, offset = 0 } = query
  return useQuery({
    queryKey: queryKeys.returns.list(branchId, saleId, status ?? '', offset),
    queryFn: () =>
      listReturns({
        ...(branchId ? { branchId } : {}),
        ...(saleId ? { saleId } : {}),
        ...(status ? { status } : {}),
        offset,
      }),
    enabled,
    staleTime: 30_000,
  })
}

export function useReturn(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.returns.detail(id ?? ''),
    queryFn: () => getReturn(id ?? ''),
    enabled: enabled && Boolean(id),
    staleTime: 15_000,
  })
}

/** Needs `returns.create`. The goods come in; no stock moves yet. */
export function useReceiveReturn() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      draft,
      idempotencyKey,
    }: {
      draft: ReceiveReturnDraft
      idempotencyKey: string
    }) => receiveReturn(draft, idempotencyKey),
    onSuccess: async (entry) => {
      await invalidateReturn(client, entry)
      await client.invalidateQueries({ queryKey: queryKeys.returns.eligible(entry.sale.id) })
      toast.success(
        entry.custody === 'customer_keeps'
          ? `${entry.reference} opened. It cannot be approved until the goods arrive`
          : `${entry.reference} in custody. A manager decides next`,
      )
    },
    onError: (error) => toast.error(messageOf(error) ?? 'Could not record the return'),
  })
}

/** The goods a customer had kept have now come in. */
export function useTakeReturnCustody() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => takeReturnCustody(id),
    onSuccess: async (entry) => {
      await invalidateReturn(client, entry)
      toast.success('Goods received. The return can be approved')
    },
    onError: (error) => toast.error(messageOf(error) ?? 'Could not take the goods in'),
  })
}

/**
 * Manager only. Fixes the refund and puts the goods on hold.
 *
 * The toast says the amount and that it is not yet paid, because approving and
 * paying are separate and a cashier who reads "approved" as "settled" sends the
 * customer away without their money.
 */
export function useApproveReturn() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      reason,
      idempotencyKey,
    }: {
      id: string
      reason?: string
      idempotencyKey: string
    }) => approveReturn(id, reason, idempotencyKey),
    onSuccess: async (entry) => {
      await invalidateReturn(client, entry)
      toast.success(
        entry.refund
          ? `Approved. ${entry.refund.total} is owed and not yet paid`
          : 'Approved',
      )
    },
    onError: (error) => toast.error(messageOf(error) ?? 'Could not approve the return'),
  })
}

/** Manager only, with a reason. The customer collects the goods afterwards. */
export function useRejectReturn() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectReturn(id, reason),
    onSuccess: async (entry) => {
      await invalidateReturn(client, entry)
      toast.success('Rejected. Nothing is owed; hand the goods back when the customer comes')
    },
    onError: (error) => toast.error(messageOf(error) ?? 'Could not reject the return'),
  })
}

export function useHandbackReturn() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, recipient }: { id: string; recipient: string }) =>
      handbackReturn(id, recipient),
    onSuccess: async (entry) => {
      await invalidateReturn(client, entry)
      toast.success('Handed back. The return is closed')
    },
    onError: (error) => toast.error(messageOf(error) ?? 'Could not record the handback'),
  })
}

/** Manager only. Hold to shelf. Omit `lines` for everything on hold. */
export function useReleaseReturn() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      lines,
      idempotencyKey,
    }: {
      id: string
      lines?: { returnLineId: string; quantity: number }[]
      idempotencyKey: string
    }) => releaseReturn(id, lines, idempotencyKey),
    onSuccess: async (entry) => {
      await invalidateReturn(client, entry)
      const released = entry.lines.reduce((total, line) => total + line.releasedQty, 0)
      toast.success(`${released} ${released === 1 ? 'unit' : 'units'} back on sale`)
    },
    onError: (error) => toast.error(messageOf(error) ?? 'Could not release the goods'),
  })
}

/** Needs `returns.refund`. Cash comes out of the open drawer; Whish does not. */
export function usePayReturnRefund() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      method,
      amount,
      recipient,
      reference,
      idempotencyKey,
    }: {
      id: string
      method: 'cash' | 'whish'
      amount: number | string
      recipient: string
      reference?: string
      idempotencyKey: string
    }) => payReturnRefund(id, { method, amount, recipient, reference }, idempotencyKey),
    onSuccess: async (entry) => {
      await invalidateReturn(client, entry)
      toast.success(
        entry.refund?.status === 'paid'
          ? 'Refund paid in full'
          : `Paid. ${formatPrice(priceOf(entry.refund?.outstanding ?? '0'))} still owed`,
      )
    },
    onError: (error) => toast.error(messageOf(error) ?? 'Could not pay the refund'),
  })
}

/** Links the replacement sale. It neither pays nor releases. */
export function useLinkReturnExchange() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, saleId }: { id: string; saleId: string }) => linkReturnExchange(id, saleId),
    onSuccess: async (entry) => {
      await invalidateReturn(client, entry)
      const net = entry.exchange
      toast.success(
        net?.direction === 'customer_pays'
          ? `Exchange linked. The customer pays ${net.net}`
          : net?.direction === 'business_pays'
            ? `Exchange linked. ${net.net.replace('-', '')} is owed to the customer`
            : 'Exchange linked. Nothing to settle',
      )
    },
    onError: (error) => toast.error(messageOf(error) ?? 'Could not link the exchange'),
  })
}
