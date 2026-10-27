'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { Field } from '@/components/shared/field'
import { LocationSelect } from '@/components/shared/location-select'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { QuantityInput } from '@/components/shared/quantity-input'
import { VariantPicker } from '@/components/shared/variant-picker'
import { useIdempotencyKey } from '@/hooks/use-idempotency-key'
import { useWarehouseId } from '@/hooks/use-inventory'
import { usePermission } from '@/hooks/use-permission'
import { useCreateTransfer } from '@/hooks/use-transfers'
import type { VariantOption } from '@/types'

interface Line {
  option: VariantOption
  quantity: number
}

export function TransferRequestView() {
  const router = useRouter()
  const { user, branchScoped } = usePermission()
  const { data: warehouseId } = useWarehouseId()
  const create = useCreateTransfer()
  const idempotency = useIdempotencyKey()

  const [fromChoice, setFrom] = useState<string | null>(null)
  const [to, setTo] = useState(branchScoped ? (user.branchId ?? '') : '')
  const [lines, setLines] = useState<Line[]>([])
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const from = fromChoice ?? warehouseId ?? ''

  const units = lines.reduce((sum, line) => sum + line.quantity, 0)
  const update = (variantId: string, quantity: number) =>
    setLines((current) => current.map((line) => (line.option.variantId === variantId ? { ...line, quantity } : line)))

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!from || !to) return setError('Pick both locations.')
    if (from === to) return setError('Pick two different locations.')
    if (units === 0) return setError('Add at least one unit.')
    setError(null)
    const input = {
      fromBranchId: from,
      toBranchId: to,
      note,
      lines: lines.filter((line) => line.quantity > 0).map((line) => ({ variantId: line.option.variantId, quantity: line.quantity })),
    }
    create.mutate(
      { input, key: idempotency.current() },
      {
        onSuccess: (transfer) => {
          idempotency.reset()
          router.push(`/transfers/${transfer.id}`)
        },
      },
    )
  }

  return (
    <>
      <Link href="/transfers" className="back-link">
        <ArrowLeft size={16} aria-hidden="true" />
        Transfers
      </Link>
      <PageHeader
        eyebrow="Transfers"
        title="New transfer"
        description="A request moves nothing yet. The sender approves it, which reserves the units."
      />
      <form className="split" onSubmit={submit} noValidate>
        <div className="stack">
          <Panel title="Route">
            <div className="panel-body form-grid">
              <Field label="From">
                <LocationSelect
                  value={from}
                  onChange={(value) => {
                    setFrom(value)
                    setLines([])
                  }}
                  exclude={to}
                />
              </Field>
              <Field label="To">
                <LocationSelect value={to} onChange={setTo} exclude={from} onlyAccessible />
              </Field>
            </div>
          </Panel>
          <Panel title="Add variants" description="Availability is at the sending location.">
            <div className="panel-body">
              <VariantPicker
                branchId={from}
                excluded={lines.map((line) => line.option.variantId)}
                locationLabel="at sender"
                onPick={(option) => setLines((current) => [...current, { option, quantity: 1 }])}
              />
            </div>
          </Panel>
        </div>
        <aside className="split-aside">
          <Panel title="Request" description={`${units} ${units === 1 ? 'unit' : 'units'} on ${lines.length} ${lines.length === 1 ? 'line' : 'lines'}`}>
            <div className="panel-body stack">
              {lines.length === 0 ? (
                <p className="muted">Nothing added yet.</p>
              ) : (
                <ul className="sale-lines stacked">
                  {lines.map((line) => (
                    <li key={line.option.variantId}>
                      <div className="sale-card-head">
                        <span>
                          <strong>{line.option.productName}</strong>
                          <small>
                            {line.option.color} / {line.option.size}
                          </small>
                        </span>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`Remove ${line.option.productName} ${line.option.color} / ${line.option.size}`}
                          onClick={() => setLines((current) => current.filter((entry) => entry !== line))}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <QuantityInput
                        value={line.quantity}
                        max={line.option.available ?? 0}
                        onChange={(quantity) => update(line.option.variantId, quantity)}
                        label={`Quantity for ${line.option.color} / ${line.option.size}`}
                        capLabel="available at sender"
                      />
                    </li>
                  ))}
                </ul>
              )}
              <Field label="Note (optional)">
                <textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
              </Field>
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className="btn btn-primary" disabled={create.isPending}>
                {create.isPending ? 'Sending…' : 'Request transfer'}
              </button>
            </div>
          </Panel>
        </aside>
      </form>
    </>
  )
}
