'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { Field } from '@/components/shared/field'
import { useExchangeRate, useSaveExchangeRate } from '@/hooks/use-exchange-rate'
import { usePermission } from '@/hooks/use-permission'
import { formatDocumentDate, formatLbp, formatPrice } from '@/lib/format'
import { clampExchangeRate, MAX_EXCHANGE_RATE_LBP } from '@/lib/input-limits'
import { ErrorState } from '@/components/shared/error-state'

export function ExchangeRateView() {
  const { can } = usePermission()
  const rateQuery = useExchangeRate()
  const save = useSaveExchangeRate()
  const [input, setInput] = useState('')

  useEffect(() => {
    if (rateQuery.data?.usdToLbp) setInput(String(rateQuery.data.usdToLbp))
  }, [rateQuery.data?.usdToLbp])

  const parsed = clampExchangeRate(Number(input) || 0)
  const exampleUsd = 100
  const exampleLbp = parsed > 0 ? Math.round(exampleUsd * parsed) : null

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (parsed <= 0) return
    save.mutate(parsed)
  }

  if (!can('settings.manage')) {
    return (
      <ErrorState title="Exchange rate is for administrators" error={new Error('Missing permission: settings.manage')} />
    )
  }

  return (
    <>
      <Link href="/dashboard" className="back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        Overview
      </Link>
      <PageHeader
        eyebrow="Settings"
        title="USD / LBP exchange rate"
        description="Set once here. Every branch and employee sees the same LBP equivalent beside dollar prices on sales screens."
      />
      <Panel title="Rate">
        <form className="panel-body stack gap-md" onSubmit={submit} style={{ maxWidth: '28rem' }}>
          <Field
            label="1 USD equals (LBP)"
            hint={`Whole pounds only. Max ${formatLbp(MAX_EXCHANGE_RATE_LBP)}.`}
          >
            <input
              type="number"
              min={1}
              max={MAX_EXCHANGE_RATE_LBP}
              step={1}
              inputMode="numeric"
              className="tabular"
              value={input}
              onChange={(event) => setInput(event.target.value.replace(/[^\d]/g, ''))}
              placeholder="89500"
              required
            />
          </Field>
          {exampleLbp !== null && parsed > 0 && (
            <p className="muted field-hint">
              Example: {formatPrice(exampleUsd)} ≈ {formatLbp(exampleLbp)}
            </p>
          )}
          {rateQuery.data && (
            <p className="muted field-hint">
              Last saved {formatDocumentDate(rateQuery.data.updatedAt)}
              {rateQuery.data.updatedByName ? ` by ${rateQuery.data.updatedByName}` : ''}.
            </p>
          )}
          <p className="muted field-hint">
            Stored on this browser until the server settings API is connected. Use the same rate on each till device, or
            connect the backend when it is available.
          </p>
          <button type="submit" className="btn btn-primary" disabled={save.isPending || parsed <= 0}>
            {save.isPending ? 'Saving…' : 'Save rate'}
          </button>
        </form>
      </Panel>
    </>
  )
}
