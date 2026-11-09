'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { Clock, Printer } from 'lucide-react'
import { CashByUserTable } from '@/components/cash/cash-by-user-table'
import { CashHandoverPanel } from '@/components/cash/cash-handover-panel'
import { CashMovementPanel } from '@/components/cash/cash-movement-panel'
import { CashShiftTimeline } from '@/components/cash/cash-shift-timeline'
import { CloseDrawerPanel } from '@/components/cash/close-drawer-panel'
import { printCashSessionXReport } from '@/components/cash/cash-session-print'
import { PriceWithLbp } from '@/components/shared/price-with-lbp'
import { useCashSessions } from '@/hooks/use-cash-sessions'
import { useCurrentUser } from '@/store/user-store'
import { priceOf } from '@/lib/api/map-catalog'
import type { ApiCashSession } from '@/lib/api/types'
import { cashSessionListItems, cashSessionTotals, shiftDisplayRef, shiftElapsed } from '@/lib/cash-display'
import { formatDocumentDate, formatNumber, formatPrice, formatRelativeDateTime } from '@/lib/format'

export function CashDrawerZLayout({
  session,
  branchName,
  canClose,
  canMove,
  canAccept,
}: {
  session: ApiCashSession
  branchName: string
  canClose: boolean
  canMove: boolean
  canAccept: boolean
}) {
  const user = useCurrentUser()
  const closeRef = useRef<HTMLDivElement>(null)
  const recent = useCashSessions({ branchId: session.branch.id, offset: 0 })
  const recentRows = cashSessionListItems(recent.data?.items).slice(0, 6)

  const totals = cashSessionTotals(session)
  const opening = priceOf(session.openingCash)
  const expected = priceOf(totals.expectedCash)
  const cashSales = priceOf(totals.cashPayments)
  const cashIn = priceOf(totals.cashIn)
  const cashOut = priceOf(totals.cashOut)
  const salesTotal = priceOf(totals.salesTotal)
  const whish = priceOf(totals.whishPayments)

  const scrollToClose = () => {
    closeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="cash-z-page">
      <header className="cash-z-hero">
        <div className="cash-z-hero-main">
          <p className="eyebrow">Till</p>
          <div className="cash-z-hero-title-row">
            <h1 className="cash-z-title">Register shifts &amp; cash drawer</h1>
            <span className="pill pill-healthy cash-z-shift-pill">
              <span className="pill-dot" aria-hidden="true" />
              {shiftDisplayRef(session.id)} · {branchName}
            </span>
          </div>
          <p className="subtitle cash-z-subtitle">
            Reconcile physical cash against expected float and digital payments. Whish never changes the cash you count.
          </p>
          <dl className="cash-z-hero-meta">
            <div>
              <dt>On screen</dt>
              <dd>{user.name}</dd>
            </div>
            <div>
              <dt>Opened</dt>
              <dd>
                {formatRelativeDateTime(session.openedAt)} · {session.openedBy.name ?? 'Unknown'}
              </dd>
            </div>
            <div>
              <dt>Elapsed</dt>
              <dd className="tabular cash-z-elapsed">
                <Clock size={14} aria-hidden="true" /> {shiftElapsed(session.openedAt)}
              </dd>
            </div>
          </dl>
        </div>
        <div className="cash-z-hero-actions heading-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => printCashSessionXReport(session, 'x')}
          >
            <Printer size={16} aria-hidden="true" />
            Print X-report
          </button>
          {canClose ? (
            <button type="button" className="btn btn-primary" onClick={scrollToClose}>
              Close register
            </button>
          ) : null}
        </div>
      </header>

      <div className="cash-z-ready-banner" role="status">
        <strong>Open</strong>
        <span>Ready to close when the physical count matches expected cash (or is explained).</span>
        <Link href={`/cash/${session.id}`} className="text-link">
          Full shift record
        </Link>
      </div>

      <div className="cash-z-kpi-grid">
        <article className="cash-z-kpi">
          <p className="cash-z-kpi-label">Total net sales</p>
          <p className="cash-z-kpi-value tabular">
            <PriceWithLbp usd={salesTotal} strong />
          </p>
          <p className="cash-z-kpi-detail muted">
            {formatNumber(totals.salesCount)} {totals.salesCount === 1 ? 'sale' : 'sales'} rung up this session
          </p>
        </article>
        <article className="cash-z-kpi cash-z-kpi--highlight">
          <p className="cash-z-kpi-label">Expected cash (USD)</p>
          <p className="cash-z-kpi-value tabular">{formatPrice(expected)}</p>
          <p className="cash-z-kpi-detail muted">
            {formatPrice(opening)} float + {formatPrice(cashSales)} cash sales + {formatPrice(cashIn)} in −{' '}
            {formatPrice(cashOut)} out
          </p>
        </article>
        <article className="cash-z-kpi">
          <p className="cash-z-kpi-label">Cash in drawer (LBP guide)</p>
          <p className="cash-z-kpi-value tabular">
            <PriceWithLbp usd={expected} />
          </p>
          <p className="cash-z-kpi-detail muted">Exchange-rate guide · drawer is counted in USD</p>
        </article>
        <article className="cash-z-kpi">
          <p className="cash-z-kpi-label">Digital / Whish</p>
          <p className="cash-z-kpi-value tabular">{formatPrice(whish)}</p>
          <p className="cash-z-kpi-detail muted">Pre-settled transfers · not in the till</p>
        </article>
      </div>

      <div className="cash-z-split">
        <div className="cash-z-main stack">
          <div ref={closeRef} className="cash-z-close-wrap">
            <CloseDrawerPanel session={session} canClose={canClose} />
          </div>
          <CashMovementPanel session={session} canMove={canMove} />
          <CashHandoverPanel session={session} canAccept={canAccept} />
          <CashByUserTable rows={session.byUser} />
        </div>

        <aside className="cash-z-aside" aria-label="Fiscal audit preview">
          <div className="cash-z-receipt">
            <p className="cash-z-receipt-brand">Bitar</p>
            <p className="cash-z-receipt-branch">{branchName}</p>
            <p className="cash-z-receipt-meta muted">
              {shiftDisplayRef(session.id)}
              <br />
              {formatDocumentDate(session.openedAt)}
            </p>
            <dl className="cash-z-receipt-lines">
              <div>
                <dt>Transactions</dt>
                <dd className="tabular">{totals.salesCount}</dd>
              </div>
              <div>
                <dt>Cash USD (sales)</dt>
                <dd className="tabular">{formatPrice(cashSales)}</dd>
              </div>
              <div>
                <dt>Whish</dt>
                <dd className="tabular">{formatPrice(whish)}</dd>
              </div>
              <div>
                <dt>Manual cash in</dt>
                <dd className="tabular">{formatPrice(cashIn)}</dd>
              </div>
              <div>
                <dt>Manual cash out</dt>
                <dd className="tabular">{formatPrice(cashOut)}</dd>
              </div>
              <div className="cash-z-receipt-total">
                <dt>Net sales (USD)</dt>
                <dd className="tabular">{formatPrice(salesTotal)}</dd>
              </div>
              <div className="cash-z-receipt-total">
                <dt>Expected in drawer</dt>
                <dd className="tabular">{formatPrice(expected)}</dd>
              </div>
            </dl>
            <p className="cash-z-receipt-foot muted">
              LBP denomination counts and VAT lines are not on the cash-session API. Figures refresh from the server every
              sale and movement.
            </p>
            <div className="cash-z-receipt-actions stack gap-sm">
              {canClose ? (
                <button type="button" className="btn btn-primary" onClick={scrollToClose}>
                  Sign, lock shift &amp; close register
                </button>
              ) : null}
              <button type="button" className="btn btn-secondary" onClick={() => printCashSessionXReport(session, 'x')}>
                <Printer size={16} aria-hidden="true" />
                Print audit slip
              </button>
            </div>
          </div>
        </aside>
      </div>

      <CashShiftTimeline sessions={recentRows} activeId={session.id} loading={recent.isPending} />
    </div>
  )
}
