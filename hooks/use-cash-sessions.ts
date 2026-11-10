'use client'

import { useMemo } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { cashSessionListItems } from '@/lib/cash-display'
import { toast } from 'sonner'
import { queryKeys } from '@/lib/query-keys'
import { useSettings } from '@/hooks/use-settings'
import { messageOf } from '@/lib/errors'
import {
  closeCashSession,
  correctCashSession,
  getCashSession,
  getCurrentCashSession,
  handOverCashSession,
  listCashSessions,
  openCashSession,
  recordCashMovement,
  reviewCashSession,
} from '@/services/cash-sessions.service'
import type {
  ApiCashSession,
  CashCorrectionInput,
  CashMovementDirection,
  CashSessionStatus,
} from '@/lib/api/types'

/**
 * The drawer, over `/cash-sessions`.
 *
 * Every write invalidates both the open session at the branch and the session
 * by id, because the till reads one and the shift screen the other, and they
 * are the same drawer.
 */
async function invalidateDrawer(
  client: ReturnType<typeof useQueryClient>,
  session: ApiCashSession,
) {
  client.setQueryData(queryKeys.cashSessions.current(session.branch.id), session)
  client.setQueryData(queryKeys.cashSessions.detail(session.id), session)
  await Promise.all([
    client.invalidateQueries({ queryKey: queryKeys.cashSessions.current(session.branch.id) }),
    client.invalidateQueries({ queryKey: queryKeys.cashSessions.detail(session.id) }),
    client.invalidateQueries({ queryKey: queryKeys.cashSessions.all }),
  ])
}

/** The open session at one branch, or `null`. The first thing a till asks. */
export function useCurrentCashSession(branchId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.cashSessions.current(branchId ?? ''),
    queryFn: () => getCurrentCashSession(branchId ?? ''),
    enabled: enabled && Boolean(branchId),
    /* The drawer changes with every sale at the till, so this is short-lived on
       purpose: an expected-cash figure that is a minute old is a wrong count. */
    staleTime: 10_000,
  })
}

/**
 * Whether the till at this branch is barred from selling for want of an open
 * drawer, which is `requireOpenCashSession` plus no open session.
 *
 * It answers `false` while either read is in flight, on purpose: the server is
 * the gate, and guessing "blocked" before the answer arrives would grey out the
 * complete-sale button on every page load. A sale sent in that window comes
 * back as a 409 with its own message, which `useCreateSale` reports.
 */
export function useDrawerBlocksSale(branchId: string | undefined): boolean {
  const settings = useSettings()
  const session = useCurrentCashSession(branchId, Boolean(branchId))
  if (!branchId) return false
  if (!settings.data?.requireOpenCashSession) return false
  if (session.isPending || session.isError) return false
  return session.data === null
}

export function useCashSession(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.cashSessions.detail(id),
    queryFn: () => getCashSession(id),
    enabled: enabled && Boolean(id),
    staleTime: 10_000,
  })
}

/** The manager's list. `review: 'flagged'` is the to-review one. */
export function useCashSessions(params: {
  branchId?: string
  status?: CashSessionStatus
  review?: 'flagged'
  offset?: number
}) {
  const { branchId = '', status, review, offset = 0 } = params
  return useQuery({
    queryKey: queryKeys.cashSessions.list(branchId, status ?? '', review ?? '', offset),
    queryFn: () =>
      listCashSessions({
        branchId: branchId || undefined,
        status,
        review,
        offset,
      }),
    staleTime: 30_000,
  })
}

/**
 * `GET /cash-sessions` list rows omit rolled-up totals; each visible row is
 * hydrated with `GET /cash-sessions/:id` so net sales and expected cash match the shift.
 */
export function useCashSessionsWithTotals(params: Parameters<typeof useCashSessions>[0]) {
  const list = useCashSessions(params)
  const ids = useMemo(
    () => cashSessionListItems(list.data?.items).map((row) => row.id),
    [list.data?.items],
  )
  const details = useQueries({
    queries: ids.map((id) => ({
      queryKey: queryKeys.cashSessions.detail(id),
      queryFn: () => getCashSession(id),
      enabled: list.isSuccess && Boolean(id),
      staleTime: 30_000,
    })),
  })
  const data = useMemo(() => {
    if (!list.data) return undefined
    const byId = new Map(
      details.flatMap((q) => (q.data ? [[q.data.id, q.data] as const] : [])),
    )
    const items = cashSessionListItems(list.data.items).map((row) => {
      const full = byId.get(row.id)
      return full ? { ...row, totals: full.totals } : row
    })
    return { ...list.data, items }
  }, [list.data, details])
  const isEnrichingTotals = details.some((q) => q.isPending)
  return { ...list, data, isEnrichingTotals }
}

export function useOpenCashSession() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      branchId,
      openingCash,
      note,
      idempotencyKey,
    }: {
      branchId: string
      openingCash: number
      note?: string
      idempotencyKey: string
    }) => openCashSession({ branchId, openingCash, note }, idempotencyKey),
    onSuccess: async (session) => {
      await invalidateDrawer(client, session)
      toast.success('Drawer open. Sales at this branch are recorded against it')
    },
    onError: (error) => toast.error(messageOf(error) ?? 'Could not open the drawer'),
  })
}

export function useRecordCashMovement() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      direction,
      amount,
      reason,
      idempotencyKey,
    }: {
      id: string
      direction: CashMovementDirection
      amount: number
      reason: string
      idempotencyKey: string
    }) => recordCashMovement(id, { direction, amount, reason }, idempotencyKey),
    onSuccess: async (session, variables) => {
      await invalidateDrawer(client, session)
      toast.success(variables.direction === 'in' ? 'Cash added to the drawer' : 'Cash taken out of the drawer')
    },
    /* A 409 here is the server saying the drawer does not hold that much. Its
       own wording names the figure, so it is better than anything we would
       write. */
    onError: (error) => toast.error(messageOf(error) ?? 'Could not record the movement'),
  })
}

/**
 * The person **taking** the drawer counts it and sends this. A count that
 * differs from the expected cash needs the note, or the server answers 400.
 */
export function useHandOverCashSession() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      countedCash,
      note,
      idempotencyKey,
    }: {
      id: string
      countedCash: number
      note?: string
      idempotencyKey: string
    }) => handOverCashSession(id, { countedCash, note }, idempotencyKey),
    onSuccess: async (session) => {
      await invalidateDrawer(client, session)
      toast.success('Drawer taken over. It is yours for this shift')
    },
    onError: (error) => toast.error(messageOf(error) ?? 'Could not hand the drawer over'),
  })
}

export function useCloseCashSession() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      countedCash,
      cashRemoved,
      differenceNote,
      idempotencyKey,
    }: {
      id: string
      countedCash: number
      cashRemoved?: number
      differenceNote?: string
      idempotencyKey: string
    }) => closeCashSession(id, { countedCash, cashRemoved, differenceNote }, idempotencyKey),
    onSuccess: async (session) => {
      await invalidateDrawer(client, session)
      await client.invalidateQueries({ queryKey: queryKeys.cashSessions.all })
      toast.success('Drawer closed')
    },
    onError: (error) => toast.error(messageOf(error) ?? 'Could not close the drawer'),
  })
}

/** Manager only, on a closed session. The original closing is kept. */
export function useCorrectCashSession() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      field,
      value,
      reason,
      idempotencyKey,
    }: {
      id: string
      field: CashCorrectionInput['field']
      value: number
      reason: string
      idempotencyKey: string
    }) => correctCashSession(id, { field, value, reason }, idempotencyKey),
    onSuccess: async (session) => {
      await invalidateDrawer(client, session)
      toast.success('Correction recorded against the closing')
    },
    onError: (error) => toast.error(messageOf(error) ?? 'Could not record the correction'),
  })
}

/** Manager only: sign off a flagged session. */
export function useReviewCashSession() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) => reviewCashSession(id, note),
    onSuccess: async (session) => {
      await invalidateDrawer(client, session)
      await client.invalidateQueries({ queryKey: queryKeys.cashSessions.all })
      toast.success('Reviewed')
    },
    onError: (error) => toast.error(messageOf(error) ?? 'Could not record the review'),
  })
}
