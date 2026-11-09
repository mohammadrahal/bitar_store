'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'
import { OpenDrawerPanel } from '@/components/cash/open-drawer-panel'
import { CashShiftTimeline } from '@/components/cash/cash-shift-timeline'
import { useCashSessions } from '@/hooks/use-cash-sessions'
import { PriceWithLbp } from '@/components/shared/price-with-lbp'
import { priceOf } from '@/lib/api/map-catalog'
import { formatPrice } from '@/lib/format'
import { cashHubHref } from '@/lib/cash-hub'
import { cashSessionListItems, cashSessionTotals } from '@/lib/cash-display'

export function CashDrawerClosedLayout({
  branchId,
  branchName,
  canOpen,
  salesBlocked,
}: {
  branchId: string
  branchName: string
  canOpen: boolean
  /** `requireOpenCashSession` and no drawer open */
  salesBlocked: boolean
}) {
  const recent = useCashSessions({ branchId, status: 'closed', offset: 0 })
  const recentRows = cashSessionListItems(recent.data?.items).slice(0, 6)
  const lastClosed = recentRows[0]
  const lastNet = lastClosed ? priceOf(cashSessionTotals(lastClosed).salesTotal) : null

  return (
    <div className="cash-z-page">
      <header className="cash-z-hero">
        <div className="cash-z-hero-main">
          <p className="eyebrow">Till</p>
          <div className="cash-z-hero-title-row">
            <h1 className="cash-z-title">Register shifts &amp; cash drawer</h1>
            <span className="pill pill-neutral cash-z-shift-pill">
              <Lock size={12} aria-hidden="true" />
              No open shift · {branchName}
            </span>
          </div>
          <p className="subtitle cash-z-subtitle">
            Open the drawer with today&apos;s float, then ring sales against this session until you close and reconcile.
          </p>
        </div>
        <Link href={cashHubHref('shifts')} className="btn btn-secondary">
          View past shifts
        </Link>
      </header>

      <div className={`cash-z-ready-banner${salesBlocked ? ' cash-z-ready-banner--warn' : ' cash-z-ready-banner--muted'}`} role="status">
        <strong>{salesBlocked ? 'Sales blocked' : 'Closed'}</strong>
        <span>
          {salesBlocked
            ? `This business requires an open drawer before completing a sale at ${branchName}.`
            : 'Open the drawer to start a new shift at this branch.'}
        </span>
      </div>

      <div className="cash-z-kpi-grid cash-z-kpi-grid--idle">
        <article className="cash-z-kpi cash-z-kpi--idle">
          <p className="cash-z-kpi-label">Total net sales</p>
          <p className="cash-z-kpi-value tabular">—</p>
          <p className="cash-z-kpi-detail muted">Updates when the drawer is open</p>
        </article>
        <article className="cash-z-kpi cash-z-kpi--idle">
          <p className="cash-z-kpi-label">Expected cash (USD)</p>
          <p className="cash-z-kpi-value tabular">—</p>
          <p className="cash-z-kpi-detail muted">Opening float + cash sales ± movements</p>
        </article>
        <article className="cash-z-kpi cash-z-kpi--idle">
          <p className="cash-z-kpi-label">Last closed shift</p>
          <p className="cash-z-kpi-value tabular">
            {lastNet !== null ? <PriceWithLbp usd={lastNet} strong /> : '—'}
          </p>
          <p className="cash-z-kpi-detail muted">
            {lastClosed ? `Net sales · ${formatPrice(lastNet ?? 0)}` : 'No prior session on record'}
          </p>
        </article>
        <article className="cash-z-kpi cash-z-kpi--idle">
          <p className="cash-z-kpi-label">Digital / Whish</p>
          <p className="cash-z-kpi-value tabular">—</p>
          <p className="cash-z-kpi-detail muted">Reported beside cash, never in the till</p>
        </article>
      </div>

      <div className="cash-z-split">
        <div className="cash-z-main">
          <div className="cash-z-open-wrap">
            <OpenDrawerPanel branchId={branchId} branchName={branchName} canOpen={canOpen} />
          </div>
        </div>

        <aside className="cash-z-aside" aria-label="Before you open">
          <div className="cash-z-receipt">
            <p className="cash-z-receipt-brand">Bitar</p>
            <p className="cash-z-receipt-branch">{branchName}</p>
            <p className="cash-z-receipt-meta muted">New shift · not started</p>
            <ol className="cash-z-open-steps">
              <li>Count every note in the till (USD).</li>
              <li>Enter the total as the opening float.</li>
              <li>Sales at this branch attach to the session automatically.</li>
              <li>Close with a physical count when the shift ends.</li>
            </ol>
            <p className="cash-z-receipt-foot muted">
              Whish payments never change expected cash. LBP is a customer guide only unless your policy counts a separate
              float.
            </p>
          </div>
        </aside>
      </div>

      {recent.isError ? (
        <p className="muted" role="alert">
          Could not load past shifts: {recent.error instanceof Error ? recent.error.message : 'Request failed'}
        </p>
      ) : (
        <CashShiftTimeline sessions={recentRows} activeId="" loading={recent.isPending} />
      )}
    </div>
  )
}
