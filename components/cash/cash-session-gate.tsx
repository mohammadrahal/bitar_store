'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Banknote } from 'lucide-react'
import { useCurrentCashSession, useOpenCashSession } from '@/hooks/use-cash-sessions'
import { useIdempotencyKey } from '@/hooks/use-idempotency-key'
import { usePermission } from '@/hooks/use-permission'
import { useSettings } from '@/hooks/use-settings'
import { cashHubHref } from '@/lib/cash-hub'
import { formatPrice } from '@/lib/format'
import { MAX_CASH_TENDERED, parseMoneyInput } from '@/lib/input-limits'
import { cashSessionTotals } from '@/lib/cash-display'
import { priceOf } from '@/lib/api/map-catalog'

/**
 * What the till says about the drawer.
 *
 * When `requireOpenCashSession` is on, `POST /sales` answers **409** at a branch
 * with no open drawer — so the cashier finds out by losing a completed sale at
 * the last step. This says it before the first item is scanned, and opens the
 * drawer **here**: sending someone to another screen and back, mid-queue, to
 * type one number is how a float gets guessed or the sale gets rung up on paper.
 *
 * With the setting off there is still a drawer worth tracking, so an open one is
 * reported quietly and a missing one is left alone — nothing is blocked, and a
 * banner about an optional feature on every sale is just noise.
 */
export function CashSessionGate({ branchId }: { branchId: string }) {
  const settings = useSettings()
  const session = useCurrentCashSession(branchId)
  const open = useOpenCashSession()
  const idempotency = useIdempotencyKey()
  const { can } = usePermission()
  const [float, setFloat] = useState('')

  const required = settings.data?.requireOpenCashSession ?? false
  const canOpen = can('cash.open', branchId || undefined)

  /* Nothing to say until both answers are in: a banner that appears for a
     moment and then vanishes reads as a glitch at the till. */
  if (!branchId || session.isPending || settings.isPending) return null
  /* The drawer is the server's business, not the sale's. If this read failed,
     the sale still goes through or the 409 explains itself. */
  if (session.isError) return null

  const current = session.data

  if (current) {
    return (
      <p className="section-note muted">
        <Banknote size={14} aria-hidden="true" /> Drawer open ·{' '}
        {formatPrice(priceOf(cashSessionTotals(current).expectedCash))} expected ·{' '}
        <Link href={cashHubHref('drawer')} className="text-link">
          Cash drawer
        </Link>
      </p>
    )
  }

  if (!required) return null

  const typed = float.trim()
  const openingCash = typed === '' ? null : parseMoneyInput(typed, MAX_CASH_TENDERED)

  const openDrawer = () => {
    if (openingCash === null || open.isPending) return
    open.mutate(
      { branchId, openingCash, idempotencyKey: idempotency.current() },
      { onSuccess: idempotency.reset },
    )
  }

  return (
    <div className="cash-gate" role="status">
      <span className="cash-gate-icon" aria-hidden="true">
        <Banknote size={18} />
      </span>
      <div className="cash-gate-copy">
        <strong>No cash drawer is open at this branch.</strong>
        <p>
          {canOpen
            ? 'A sale cannot be completed until the drawer is open. Count what is in the till and open it here.'
            : 'A sale cannot be completed until the drawer is open. Ask a manager, or someone with the cash drawer permission, to open it.'}
        </p>
      </div>
      {canOpen && (
        /* Rendered inside the sale <form>, so this cannot be a <form> of its own. */
        <div className="cash-gate-form" role="group" aria-label="Open the cash drawer">
          <label className="sr-only" htmlFor="cash-gate-float">
            Opening float
          </label>
          <input
            id="cash-gate-float"
            type="text"
            inputMode="decimal"
            className="input tabular"
            value={float}
            placeholder="Opening float"
            onChange={(event) => setFloat(event.target.value.replace(/[^\d.]/g, ''))}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              openDrawer()
            }}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={open.isPending || openingCash === null}
            onClick={openDrawer}
          >
            {open.isPending ? 'Opening…' : 'Open the drawer'}
          </button>
        </div>
      )}
    </div>
  )
}
