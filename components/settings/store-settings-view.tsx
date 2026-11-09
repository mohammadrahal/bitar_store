'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { FadeIn } from '@/components/motion/fade-in'
import { SettingsCard, SettingsRow, SettingsSectionTitle } from '@/components/account/settings-row'
import { PageHeader } from '@/components/shared/page-header'
import { useSettings, useSaveExchangeRate, useUpdateSettings } from '@/hooks/use-settings'
import { useModalBehavior } from '@/hooks/use-modal-behavior'
import { formatLbp, formatPrice, formatUsdLbpRate } from '@/lib/format'
import { clampExchangeRate, MAX_EXCHANGE_RATE_LBP } from '@/lib/input-limits'
import { ErrorState } from '@/components/shared/error-state'
import { SwitchToggle } from '@/components/shared/switch'
import { usePermission } from '@/hooks/use-permission'
import { adminHubHref } from '@/lib/admin-hub'
import { SETTINGS_FALLBACK } from '@/services/settings.service'
import type { ApiSettings } from '@/lib/api/types'

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

/**
 * A whole-number rule on `PUT /settings`, saved from the row it sits on.
 *
 * It commits on blur rather than behind a Save button: the row holds one
 * number, and a button per row would be two clicks for a one-character change.
 * An unchanged or unparseable value sends nothing.
 */
function NumberSettingRow({
  label,
  description,
  value,
  min,
  max,
  unit,
  onCommit,
  saving,
}: {
  label: string
  description: string
  value: number
  min: number
  max: number
  unit: string
  onCommit: (next: number) => void
  saving: boolean
}) {
  const [draft, setDraft] = useState(String(value))

  /* The server's answer wins: another manager may have changed it, and a failed
     save has to put the real figure back in the box. */
  useEffect(() => setDraft(String(value)), [value])

  const commit = () => {
    const parsed = Math.round(Number(draft))
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
      setDraft(String(value))
      return
    }
    if (parsed === value) return
    onCommit(parsed)
  }

  return (
    <SettingsRow label={`${label} (${unit})`} description={description}>
      <input
        className="settings-input tabular"
        inputMode="numeric"
        value={draft}
        disabled={saving}
        onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, ''))}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            event.currentTarget.blur()
          }
          if (event.key === 'Escape') setDraft(String(value))
        }}
        aria-label={`${label} in ${unit}`}
      />
    </SettingsRow>
  )
}

export function StoreSettingsView({ embedded = false }: { embedded?: boolean } = {}) {
  const { can } = usePermission()
  const settingsQuery = useSettings()
  const update = useUpdateSettings()
  const [dialogOpen, setDialogOpen] = useState(false)

  if (!can('settings.manage')) {
    return (
      <ErrorState title="Store settings need the settings permission" error={new Error('Missing permission: settings.manage')} />
    )
  }

  if (settingsQuery.isError) {
    return <ErrorState title="Could not load the store settings" error={settingsQuery.error as Error} />
  }

  const settings: ApiSettings = settingsQuery.data ?? SETTINGS_FALLBACK
  const rate = settings.exchangeRateUsdLbp
  const loading = settingsQuery.isPending

  return (
    <>
      {!embedded ? (
        <PageHeader
          eyebrow="Admin"
          title="Store settings"
          description="Rates and rules that every branch uses on the till."
        />
      ) : null}

      <FadeIn className="settings-page">
        <SettingsSectionTitle
          title="Currency"
          description="USD prices on the till show an LBP equivalent using this rate."
        />
        <SettingsCard>
          <div className="settings-currency-hero">
            <p className="settings-rate-large tabular">
              {loading ? '…' : rate !== null ? formatUsdLbpRate(rate) : 'No rate set yet'}
            </p>
            <button type="button" className="btn btn-primary" onClick={() => setDialogOpen(true)} disabled={loading}>
              {rate !== null ? 'Update rate' : 'Set rate'}
            </button>
            <p className="settings-row-desc">
              Saved on the server, so every till and every employee reads the same rate. Who changed it and when is in
              the audit log.
            </p>
          </div>
        </SettingsCard>

        <SettingsSectionTitle title="Sales rules" description="Return windows and reservation defaults for social orders." />
        <SettingsCard>
          <NumberSettingRow
            label="Return period"
            description="How long after a sale a customer may bring the goods back. Every return screen reads this."
            value={settings.returnPeriodDays}
            min={0}
            max={365}
            unit="days"
            saving={update.isPending || loading}
            onCommit={(returnPeriodDays) => update.mutate({ returnPeriodDays })}
          />
          <NumberSettingRow
            label="Default reservation period"
            description="How long a social-media order holds its stock before the reservation lapses."
            value={settings.defaultReservationDays}
            min={0}
            max={90}
            unit="days"
            saving={update.isPending || loading}
            onCommit={(defaultReservationDays) => update.mutate({ defaultReservationDays })}
          />
        </SettingsCard>

        <SettingsSectionTitle
          title="Cash drawer"
          description="Whether a branch has to open a drawer before it can sell."
        />
        <SettingsCard>
          <SettingsRow
            label="Require an open cash session"
            description="When on, a till with no open drawer cannot complete a sale: it is sent to open one first."
          >
            <SwitchToggle
              checked={settings.requireOpenCashSession}
              disabled={update.isPending || loading}
              onCheckedChange={(requireOpenCashSession) => update.mutate({ requireOpenCashSession })}
              label="Require an open cash session before a sale"
            />
          </SettingsRow>
        </SettingsCard>

        <SettingsSectionTitle title="Locations" description="Branches and the warehouse." />
        <SettingsCard>
          <SettingsRow label="Manage locations" description="Open the locations list to add or edit branches.">
            <Link href={adminHubHref('locations')} className="btn btn-secondary settings-inline-link">
              Locations
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </SettingsRow>
        </SettingsCard>
      </FadeIn>

      {dialogOpen && <UpdateRateDialog initial={rate ?? 0} onClose={() => setDialogOpen(false)} />}
    </>
  )
}
