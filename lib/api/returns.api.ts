import type { PageRequestFn, RequestFn } from '@/lib/api/client'
import { queryOf } from '@/lib/api/query'
import type {
  ApiReturn,
  ApiReturnSummary,
  ApiReturnableSale,
  ApproveReturnInput,
  CreateReturnInput,
  HandbackReturnInput,
  LinkExchangeInput,
  ListReturnsParams,
  RefundPaymentInput,
  RejectReturnInput,
  ReleaseReturnInput,
} from '@/lib/api/types'

/**
 * `/returns`: a customer bringing goods back (BL-04 rules 31 to 37).
 *
 * **Four separate acts, none of which triggers another.** This is the shape of
 * the whole module and the reason there is no one-press "settle return":
 *
 * 1. `receiveReturn` takes the goods into **custody**. No stock moves — they
 *    are still the customer's.
 * 2. `approveReturn` (a manager) moves them **once** into the business's
 *    on-hold bucket at the receiving branch and fixes the refund amount.
 * 3. `releaseReturn` (a manager) is what later puts units on the shelf.
 * 4. `payRefund` hands the money back, in whole or in parts.
 *
 * Approving does not pay, paying does not release, and releasing does not pay.
 * A screen that bundles them re-invents a rule the business rejected.
 *
 * Every step that moves goods or money takes an `Idempotency-Key`, because a
 * retry at the counter must not refund twice. `custody`, `reject`, `handback`
 * and `exchange` move neither, so they take none.
 *
 * Permissions, which are not symmetrical: `returns.create` receives goods,
 * takes custody and hands a rejected return back; **only a manager** approves,
 * rejects or releases, whatever is granted to an employee; `returns.refund`
 * pays. A return is visible to the branch that took the goods and to the branch
 * that sold them — to anyone else it 404s rather than 403s.
 */
export function createReturnsApi(request: RequestFn, pageRequest: PageRequestFn) {
  return {
    /**
     * Find the sale a return starts from, by its id **or** its printed number.
     *
     * A customer may return at any branch, so this deliberately does not filter
     * by where the sale was made. It answers 404 for an unknown sale and 400
     * for a key shorter than 3 characters.
     */
    getReturnableSale: (sale: string) =>
      request<ApiReturnableSale>(`/returns/eligible${queryOf({ sale })}`),

    listReturnsPage: (params: ListReturnsParams = {}) =>
      pageRequest<ApiReturnSummary>(`/returns${queryOf({ ...params })}`),

    getReturn: (id: string) => request<ApiReturn>(`/returns/${id}`),

    /** Takes the goods into custody. 201. */
    receiveReturn: (input: CreateReturnInput, idempotencyKey: string) =>
      request<ApiReturn>('/returns', 'POST', input, { idempotencyKey }),

    /**
     * Records that a customer who kept the goods has now brought them in.
     * Only needed for a return created with `custody: 'customer_keeps'`, which
     * cannot be approved until this is done.
     */
    takeReturnCustody: (id: string) => request<ApiReturn>(`/returns/${id}/custody`, 'POST'),

    /** Manager only. Goods enter the hold and the refund amount is fixed. */
    approveReturn: (id: string, input: ApproveReturnInput, idempotencyKey: string) =>
      request<ApiReturn>(`/returns/${id}/approve`, 'POST', input, { idempotencyKey }),

    /** Manager only, and the reason is required. No stock moves, no refund is owed. */
    rejectReturn: (id: string, input: RejectReturnInput) =>
      request<ApiReturn>(`/returns/${id}/reject`, 'POST', input),

    /** Closes a rejected return by recording who collected the goods. */
    handbackReturn: (id: string, input: HandbackReturnInput) =>
      request<ApiReturn>(`/returns/${id}/handback`, 'POST', input),

    /**
     * Manager only. Moves units from hold to sellable — send `lines` for part,
     * or an empty body for everything still on hold.
     */
    releaseReturn: (id: string, input: ReleaseReturnInput, idempotencyKey: string) =>
      request<ApiReturn>(`/returns/${id}/release`, 'POST', input, { idempotencyKey }),

    /**
     * Pays some or all of the refund. 201.
     *
     * A **cash** refund comes out of the open drawer at the paying branch and
     * is refused with 409 when `requireOpenCashSession` is on and none is open.
     * Whish never touches the drawer.
     */
    payReturnRefund: (id: string, input: RefundPaymentInput, idempotencyKey: string) =>
      request<ApiReturn>(`/returns/${id}/refunds`, 'POST', input, { idempotencyKey }),

    /**
     * Links the replacement sale to an approved return and records the net.
     * The sale must be at the receiving branch, made after the goods came in,
     * and not already the exchange of another return.
     */
    linkReturnExchange: (id: string, input: LinkExchangeInput) =>
      request<ApiReturn>(`/returns/${id}/exchange`, 'POST', input),
  }
}

export type ReturnsApi = ReturnType<typeof createReturnsApi>
