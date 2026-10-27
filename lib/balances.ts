import type { Balances } from '@/types'

export function sumBalances(rows: Balances[]): Balances {
  return rows.reduce<Balances>(
    (sum, row) => ({
      onHand: sum.onHand + row.onHand,
      reserved: sum.reserved + row.reserved,
      onHold: sum.onHold + row.onHold,
      available: sum.available + row.available,
      inTransit: sum.inTransit + row.inTransit,
    }),
    { onHand: 0, reserved: 0, onHold: 0, available: 0, inTransit: 0 },
  )
}
