import type { PageRequestFn, RequestFn } from '@/lib/api/client'
import { queryOf } from '@/lib/api/query'
import type {
  ApiCashSession,
  ApiCashSessionSummary,
  CashCorrectionInput,
  CashHandoverInput,
  CashMovementInput,
  CloseCashSessionInput,
  ListCashSessionsParams,
  OpenCashSessionInput,
} from '@/lib/api/types'

/**
 * `/cash-sessions`: the drawer.
 *
 * A sale is attached to the branch's open session **by the server**, so
 * `POST /sales` sends nothing extra. When `requireOpenCashSession` is on in
 * `GET /settings` and no session is open, that sale answers **409**.
 *
 * Permissions, from `GET /auth/me`: `cash.open`, `cash.accept`, `cash.close`,
 * `cash.move`. A manager holds all four; an employee only what was granted.
 *
 * Money changing calls take an `Idempotency-Key` so a retry after a lost answer
 * replays the first one instead of taking cash out of the drawer twice.
 */
export function createCashSessionsApi(request: RequestFn, pageRequest: PageRequestFn) {
  return {
    /** The branch's open session, or `null`. The first thing a till asks. */
    getCurrentCashSession: (branchId: string) =>
      request<ApiCashSession | null>(`/cash-sessions/current${queryOf({ branchId })}`),
    listCashSessionsPage: (params: ListCashSessionsParams = {}) =>
      pageRequest<ApiCashSessionSummary>(`/cash-sessions${queryOf({ ...params })}`),
    getCashSession: (id: string) => request<ApiCashSession>(`/cash-sessions/${id}`),
    /** Needs `cash.open`. */
    openCashSession: (input: OpenCashSessionInput, idempotencyKey: string) =>
      request<ApiCashSession>('/cash-sessions', 'POST', input, { idempotencyKey }),
    /** Needs `cash.move`. 409 when more is taken out than the drawer is expected to hold. */
    recordCashMovement: (id: string, input: CashMovementInput, idempotencyKey: string) =>
      request<ApiCashSession>(`/cash-sessions/${id}/movements`, 'POST', input, { idempotencyKey }),
    /**
     * Needs `cash.accept`, and is sent by the person **taking** the drawer after
     * counting it. A count that differs from `totals.expectedCash` requires the
     * note (400 without one). Logging out is not a handover.
     */
    handOverCashSession: (id: string, input: CashHandoverInput, idempotencyKey: string) =>
      request<ApiCashSession>(`/cash-sessions/${id}/handover`, 'POST', input, { idempotencyKey }),
    /** Needs `cash.close`. A difference needs `differenceNote` but never blocks the closing. */
    closeCashSession: (id: string, input: CloseCashSessionInput, idempotencyKey: string) =>
      request<ApiCashSession>(`/cash-sessions/${id}/close`, 'POST', input, { idempotencyKey }),
    /** Manager only, on a closed session. The original `closing` is kept beside `effective`. */
    correctCashSession: (id: string, input: CashCorrectionInput, idempotencyKey: string) =>
      request<ApiCashSession>(`/cash-sessions/${id}/corrections`, 'POST', input, { idempotencyKey }),
    /** Manager only: signs off a flagged session. */
    reviewCashSession: (id: string, note?: string) =>
      request<ApiCashSession>(`/cash-sessions/${id}/review`, 'POST', note?.trim() ? { note: note.trim() } : {}),
  }
}

export type CashSessionsApi = ReturnType<typeof createCashSessionsApi>
