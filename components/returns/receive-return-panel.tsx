'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Receipt, Undo2 } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'
import { ErrorState } from '@/components/shared/error-state'
import { Field } from '@/components/shared/field'
import { Panel } from '@/components/shared/panel'
import { SearchInput } from '@/components/shared/search-input'
import { SelectInput } from '@/components/shared/select-input'
import { Switch } from '@/components/shared/switch'
import { Skeleton } from '@/components/shared/skeleton'
import { useIdempotencyKey } from '@/hooks/use-idempotency-key'
import { useReceiveReturn, useReturnableSale } from '@/hooks/use-returns'
import { usePermission } from '@/hooks/use-permission'
import { priceOf } from '@/lib/api/map-catalog'
import { formatDocumentDate, formatPrice } from '@/lib/format'
import { RETURN_CONDITION_OPTIONS, fullyReturned } from '@/services/returns.service'
import type { ApiReturnCondition, ApiReturnableSale } from '@/lib/api/types'

/** What the counter has chosen to take back, per sale line. */
interface Picked {
  quantity: number
  condition: ApiReturnCondition
}

/**
 * The return desk: find the sale, take the goods, nothing else.
 *
 * Deliberately **one screen with no stock in it**. Receiving a return moves no
 * stock at all — the goods stay the customer's until a manager approves — so
 * this form records custody and stops. The decision, the refund and the release
 * happen on the return's own page, by people who may not be standing here.
 *
 * The sale is found by **receipt number or id, at any branch**. A customer can
 * return to any shop in the network, so this never filters by where they are.
 */
export function ReceiveReturnPanel({ branchId }: { branchId: string }) {
  const router = useRouter()
  const { canRecordReturns, canDecideReturns } = usePermission()
  const receive = useReceiveReturn()
  const idempotency = useIdempotencyKey()

  const [saleKey, setSaleKey] = useState('')
  const [picked, setPicked] = useState<Record<string, Picked>>({})
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [goodsInHand, setGoodsInHand] = useState(true)
  const [lateReason, setLateReason] = useState('')

  const lookup = useReturnableSale(saleKey)
  const sale = lookup.data ?? null

  /* A new sale clears the basket: carrying line choices from the last receipt
     over to this one is how the wrong customer's goods get recorded. */
  const onSaleKeyChange = (value: string) => {
    setSaleKey(value)
    setPicked({})
    setLateReason('')
  }

  if (!canRecordReturns()) {
    return (
      <Panel title="Take a return" description="Goods a customer is bringing back.">
        <p className="panel-body muted">
          Taking a return needs the returns permission. Ask a manager to add it, or to take this one
          in for you.
        </p>
      </Panel>
    )
  }

  return (
    <>
      <Panel
        title="Take a return"
        description="Find the sale on the customer's receipt. A return can be taken at any branch, whichever shop sold it."
      >
        <div className="panel-body stack gap-md">
          <Field
            label="Receipt number"
            hint="The number printed on the receipt, like S-00000012. The sale id works too."
          >
            <SearchInput
              value={saleKey}
              onChange={onSaleKeyChange}
              placeholder="S-00000012"
              aria-label="Find the sale by receipt number"
            />
          </Field>

          {saleKey.trim().length > 0 && saleKey.trim().length < 3 ? (
            <p className="muted text-sm" style={{ margin: 0 }}>
              Keep typing — at least three characters.
            </p>
          ) : null}

          {lookup.isPending && saleKey.trim().length >= 3 ? <Skeleton rows={2} stats={0} /> : null}

          {lookup.isError ? (
            <ErrorState
              title="Could not look up that sale"
              error={lookup.error}
              onRetry={() => void lookup.refetch()}
            />
          ) : null}

          {!lookup.isPending && !lookup.isError && saleKey.trim().length >= 3 && sale === null ? (
            <EmptyState
              icon={Receipt}
              title="No sale with that number"
              description="Check the receipt and try again. Only a completed till sale can be returned."
            />
          ) : null}
        </div>
      </Panel>

      {sale ? (
        <SaleReturnForm
          sale={sale}
          branchId={branchId}
          picked={picked}
          onPickedChange={setPicked}
          reason={reason}
          onReasonChange={setReason}
          note={note}
          onNoteChange={setNote}
          goodsInHand={goodsInHand}
          onGoodsInHandChange={setGoodsInHand}
          lateReason={lateReason}
          onLateReasonChange={setLateReason}
          mayGrantException={canDecideReturns()}
          pending={receive.isPending}
          onSubmit={(lines) =>
            receive.mutate(
              {
                draft: {
                  saleId: sale.sale.id,
                  receivingBranchId: branchId,
                  reason,
                  note: note.trim() || undefined,
                  goodsInHand,
                  lines,
                  lateExceptionReason: sale.withinPeriod ? undefined : lateReason.trim() || undefined,
                },
                idempotencyKey: idempotency.current(),
              },
              {
                onSuccess: (entry) => {
                  idempotency.reset()
                  setPicked({})
                  setReason('')
                  setNote('')
                  setLateReason('')
                  setSaleKey('')
                  /* Straight to the return: the next act is a manager's
                     decision, and the person who just took the goods in is the
                     one who can tell them what state they are in. */
                  router.push(`/returns/${entry.id}`)
                },
              },
            )
          }
        />
      ) : null}
    </>
  )
}

/** The sale is found: now what is coming back, and why. */
function SaleReturnForm({
  sale,
  branchId,
  picked,
  onPickedChange,
  reason,
  onReasonChange,
  note,
  onNoteChange,
  goodsInHand,
  onGoodsInHandChange,
  lateReason,
  onLateReasonChange,
  mayGrantException,
  pending,
  onSubmit,
}: {
  sale: ApiReturnableSale
  branchId: string
  picked: Record<string, Picked>
  onPickedChange: (next: Record<string, Picked>) => void
  reason: string
  onReasonChange: (value: string) => void
  note: string
  onNoteChange: (value: string) => void
  goodsInHand: boolean
  onGoodsInHandChange: (value: boolean) => void
  lateReason: string
  onLateReasonChange: (value: string) => void
  mayGrantException: boolean
  pending: boolean
  onSubmit: (lines: { skuId: string; quantity: number; condition: ApiReturnCondition }[]) => void
}) {
  const nothingLeft = fullyReturned(sale)
  const late = !sale.withinPeriod

  const lines = Object.entries(picked)
    .filter(([, value]) => value.quantity > 0)
    .map(([skuId, value]) => ({ skuId, quantity: value.quantity, condition: value.condition }))

  const units = lines.reduce((total, line) => total + line.quantity, 0)
  const lateBlocked = late && (!mayGrantException || lateReason.trim().length < 3)
  const ready =
    Boolean(branchId) && units > 0 && reason.trim().length >= 3 && !lateBlocked && !pending

  /* The value coming back, from the sale's own line totals. The *refund* is
     fixed by the server at approval and may differ if the same sale has been
     returned against before, so this is labelled as an estimate, never as the
     amount owed. */
  const estimate = lines.reduce((total, line) => {
    const row = sale.lines.find((candidate) => candidate.skuId === line.skuId)
    if (!row || row.sold === 0) return total
    return total + (priceOf(row.lineTotal) * line.quantity) / row.sold
  }, 0)

  return (
    <Panel
      title={`Sale ${sale.sale.reference}`}
      description={`${formatDocumentDate(sale.sale.soldAt)} at ${sale.sale.branch.name} · ${formatPrice(
        priceOf(sale.sale.total),
      )} · ${sale.daysSinceSale} ${sale.daysSinceSale === 1 ? 'day' : 'days'} ago`}
    >
      <div className="panel-body stack gap-md">
        {nothingLeft ? (
          <EmptyState
            icon={Undo2}
            title="Everything on this sale is already back"
            description="Every line has been returned or is in custody on another return."
          />
        ) : (
          <>
            {late ? (
              <div className="cash-gate" role="status">
                <div className="cash-gate-copy">
                  <strong>
                    This sale is {sale.daysSinceSale} days old, past the {sale.returnPeriodDays}-day
                    return window.
                  </strong>
                  <p>
                    {mayGrantException
                      ? 'A manager can still take it back by writing why. The exception is recorded against your name.'
                      : 'Only a manager can take back a sale this old. Ask one to do it, or to write the exception.'}
                  </p>
                </div>
              </div>
            ) : null}

            {late && mayGrantException ? (
              <Field
                label="Why you are taking it back anyway"
                hint="Recorded on the return, with your name. 3 to 200 characters."
              >
                <input
                  type="text"
                  value={lateReason}
                  onChange={(event) => onLateReasonChange(event.target.value)}
                  placeholder="The owner agreed by phone"
                  maxLength={200}
                  disabled={pending}
                />
              </Field>
            ) : null}

            <div className="table-wrap">
              <table className="card-table">
                <caption className="sr-only">What was sold, and what may come back</caption>
                <thead>
                  <tr>
                    <th scope="col">Item</th>
                    <th scope="col" className="num">
                      Sold
                    </th>
                    <th scope="col" className="num">
                      Can return
                    </th>
                    <th scope="col" className="num">
                      Coming back
                    </th>
                    <th scope="col">Condition</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.lines.map((line) => {
                    const choice = picked[line.skuId]
                    const exhausted = line.returnable === 0
                    return (
                      <tr key={line.saleLineId} className={exhausted ? 'muted' : undefined}>
                        <td className="card-title">
                          {line.description}
                          <small>
                            {line.skuCode}
                            {line.returned > 0 ? ` · ${line.returned} already returned` : ''}
                            {line.inCustody > 0 ? ` · ${line.inCustody} in custody` : ''}
                          </small>
                        </td>
                        <td className="num tabular" data-label="Sold">
                          {line.sold}
                        </td>
                        <td className="num tabular" data-label="Can return">
                          {line.returnable}
                        </td>
                        <td className="num" data-label="Coming back">
                          <input
                            type="number"
                            className="qty-input tabular"
                            min={0}
                            max={line.returnable}
                            step={1}
                            value={choice?.quantity ?? 0}
                            disabled={exhausted || pending}
                            aria-label={`Units of ${line.skuCode} coming back`}
                            onChange={(event) => {
                              const raw = Number(event.target.value)
                              const quantity = Number.isFinite(raw)
                                ? Math.max(0, Math.min(line.returnable, Math.trunc(raw)))
                                : 0
                              const next = { ...picked }
                              if (quantity === 0) delete next[line.skuId]
                              else
                                next[line.skuId] = {
                                  quantity,
                                  condition: choice?.condition ?? 'as_new',
                                }
                              onPickedChange(next)
                            }}
                          />
                        </td>
                        <td data-label="Condition">
                          <SelectInput
                            value={choice?.condition ?? 'as_new'}
                            onValueChange={(value) => {
                              if (!choice) return
                              onPickedChange({
                                ...picked,
                                [line.skuId]: {
                                  quantity: choice.quantity,
                                  condition: value as ApiReturnCondition,
                                },
                              })
                            }}
                            aria-label={`Condition of ${line.skuCode}`}
                            disabled={!choice || pending}
                            options={RETURN_CONDITION_OPTIONS.map((option) => ({
                              value: option.value,
                              label: option.label,
                            }))}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <Field
              label="Why it is coming back"
              hint="The customer's reason, in their words. 3 to 200 characters."
            >
              <input
                type="text"
                value={reason}
                onChange={(event) => onReasonChange(event.target.value)}
                placeholder="Does not fit"
                maxLength={200}
                disabled={pending}
              />
            </Field>

            <Field label="Note (optional)" hint="Anything about the state of the goods or the tags.">
              <input
                type="text"
                value={note}
                onChange={(event) => onNoteChange(event.target.value)}
                placeholder="Tag still on"
                maxLength={200}
                disabled={pending}
              />
            </Field>

            <Switch
              checked={goodsInHand}
              disabled={pending}
              onCheckedChange={onGoodsInHandChange}
              label="The goods are here"
              description="Turn this off if the customer is keeping them for now. The return is recorded either way, but it cannot be approved until the goods arrive."
            />

            {units > 0 ? (
              <p className="section-note muted">
                {units} {units === 1 ? 'unit' : 'units'} coming back, worth about{' '}
                {formatPrice(estimate)} of what was paid. The refund is fixed when a manager approves
                it, and is not paid by this step.
              </p>
            ) : null}

            {!branchId ? (
              <p className="field-error" style={{ margin: 0 }}>
                Choose which branch is taking the goods first.
              </p>
            ) : null}

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!ready}
                onClick={() => onSubmit(lines)}
              >
                {pending
                  ? 'Recording…'
                  : goodsInHand
                    ? 'Take the goods in'
                    : 'Record without the goods'}
              </button>
            </div>
          </>
        )}
      </div>
    </Panel>
  )
}
