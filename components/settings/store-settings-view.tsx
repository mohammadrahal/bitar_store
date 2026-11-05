'use client'

import Link from 'next/link'
import { useId, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { FadeIn } from '@/components/motion/fade-in'
import { SettingsCard, SettingsRow, SettingsSectionTitle } from '@/components/account/settings-row'
import { PageHeader } from '@/components/shared/page-header'
import { useExchangeRate, useExchangeRateHistory, useSaveExchangeRate } from '@/hooks/use-exchange-rate'
import { useModalBehavior } from '@/hooks/use-modal-behavior'
import { formatDocumentDate, formatLbp, formatPrice, formatSettingsDateTime, formatUsdLbpRate } from '@/lib/format'
import { clampExchangeRate, MAX_EXCHANGE_RATE_LBP } from '@/lib/input-limits'
import { ErrorState } from '@/components/shared/error-state'
import { usePermission } from '@/hooks/use-permission'

function UpdateRateDialog({ initial, onClose }: { initial: number; onClose: (saved: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descId = useId()
  const save = useSaveExchangeRate()
  const [input, setInput] = useState(String(initial || ''))
  const parsed = clampExchangeRate(Number(input.replace(/[^\d]/g, '')) || 0)
  const previewUsd = 45
  const previewLbp = parsed > 0 ? Math.round(previewUsd * parsed) : null

  useModalBehavior(ref, () => onClose(false))

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (parsed <= 0) return
    save.mutate(parsed, { onSuccess: () => onClose(true) })
  }

  return (
    <div className="overlay overlay-center">
      <div className="overlay-backdrop" onClick={() => onClose(false)} aria-hidden="true" />
      <div ref={ref} className="dialog dialog-sm" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descId}>
        <h2 id={titleId}>Update exchange rate</h2>
        <p id={descId} className="muted">
          The new rate applies to new sales only. Past sales keep the rate they used.
        </p>
        <form className="stack gap-md" onSubmit={submit}>
          <label className="stack gap-xs">
            <span className="settings-row-title">1 USD equals (LBP)</span>
            <input
              className="settings-input tabular"
              inputMode="numeric"
              value={input}
              onChange={(event) => setInput(event.target.value.replace(/[^\d]/g, ''))}
              placeholder="89500"
              autoFocus
            />
            <span className="settings-row-desc">Whole pounds only. Max {formatLbp(MAX_EXCHANGE_RATE_LBP)}.</span>
          </label>
          {previewLbp !== null && parsed > 0 && (
            <p className="settings-rate-preview tabular">
              {formatPrice(previewUsd)} = {formatLbp(previewLbp)}
            </p>
          )}
          <div className="dialog-actions">
            <button type="button" className="btn btn-secondary" onClick={() => onClose(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={save.isPending || parsed <= 0}>
              {save.isPending ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function StoreSettingsView() {
  const { can } = usePermission()
  const rateQuery = useExchangeRate()
  const historyQuery = useExchangeRateHistory()
  const [dialogOpen, setDialogOpen] = useState(false)

  if (!can('settings.manage')) {
    return (
      <ErrorState title="Store settings are for Super Admins" error={new Error('Missing permission: settings.manage')} />
    )
  }

  const rate = rateQuery.data

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Store settings"
        description="Rates and rules that every branch uses on the till."
      />

      <FadeIn className="settings-page">
        <SettingsSectionTitle
          title="Currency"
          description="USD prices on the till show an LBP equivalent using this rate."
        />
        <SettingsCard>
          <div className="settings-currency-hero">
            <p className="settings-rate-large tabular">{rate ? formatUsdLbpRate(rate.usdToLbp) : 'No rate set yet'}</p>
            {rate && (
              <p className="settings-row-desc">
                Last updated {formatSettingsDateTime(rate.updatedAt)}
                {rate.updatedByName ? ` by ${rate.updatedByName}` : ''}
              </p>
            )}
            <button type="button" className="btn btn-primary" onClick={() => setDialogOpen(true)}>
              Update rate
            </button>
            <p className="settings-row-desc">
              Stored on this browser until the server settings API is connected. Use the same rate on each till device.
            </p>
          </div>

          <div className="settings-subsection">
            <h3 className="settings-section-title">Rate history</h3>
            <div className="table-wrap">
              <table>
                <caption className="sr-only">Recent exchange rate changes</caption>
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col" className="num">
                      Rate
                    </th>
                    <th scope="col">Changed by</th>
                  </tr>
                </thead>
                <tbody>
                  {(historyQuery.data ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="muted">
                        No history yet.
                      </td>
                    </tr>
                  ) : (
                    (historyQuery.data ?? []).map((row) => (
                      <tr key={`${row.updatedAt}-${row.usdToLbp}`}>
                        <td>{formatDocumentDate(row.updatedAt)}</td>
                        <td className="num tabular">{formatUsdLbpRate(row.usdToLbp)}</td>
                        <td>{row.updatedByName ?? '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </SettingsCard>

        <SettingsSectionTitle title="Sales rules" description="Return windows and reservation defaults for social orders." />
        <SettingsCard>
          <SettingsRow label="Return period (days)" description="Coming soon — requires a store settings API.">
            <input className="settings-input" disabled placeholder="Coming soon" aria-disabled="true" />
          </SettingsRow>
          <SettingsRow
            label="Default reservation period (hours)"
            description="For social media orders. Coming soon — requires a store settings API."
          >
            <input className="settings-input" disabled placeholder="Coming soon" aria-disabled="true" />
          </SettingsRow>
        </SettingsCard>

        <SettingsSectionTitle title="Locations" description="Branches and the warehouse." />
        <SettingsCard>
          <SettingsRow label="Manage locations" description="Open the locations list to add or edit branches.">
            <Link href="/branches" className="btn btn-secondary settings-inline-link">
              Locations
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </SettingsRow>
        </SettingsCard>
      </FadeIn>

      {dialogOpen && (
        <UpdateRateDialog initial={rate?.usdToLbp ?? 0} onClose={() => setDialogOpen(false)} />
      )}
    </>
  )
}
