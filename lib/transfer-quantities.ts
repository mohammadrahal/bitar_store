import type { ApiTransferLine } from '@/lib/api/types'

/**
 * Good stock still on hold that `POST /transfers/:id/accept` may release.
 * Damaged units stay on hold and are never included.
 */
export function releasableGoodQuantity(line: ApiTransferLine): number {
  const goodReceived = Math.max(0, line.received - line.damaged)
  const pendingGood = Math.max(0, goodReceived - line.releasedToSellable - line.lost)
  if (line.onHold <= 0 || pendingGood <= 0) return 0
  return Math.min(line.onHold, pendingGood)
}
