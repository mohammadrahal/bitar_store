'use client'

import { useId, useMemo, useState } from 'react'
import { Info } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { Panel } from '@/components/shared/panel'
import { formatPrice, formatShortDate } from '@/lib/format'
import {
  REFUND_METHOD_LABELS,
  RETURN_ACTION_SEQUENCE,
  RETURN_CONDITIONS,
  RETURN_DECISIONS,
  returnConditionRule,
  returnDecisionRule,
  settleReturn,
  type RefundMethod,
  type ReturnCondition,
  type ReturnDecision,
} from '@/lib/return-grades'

export type { ReturnCondition, ReturnDecision, RefundMethod } from '@/lib/return-grades'

export interface ReturnedLine {
  /** The SKU barcode as it is printed on the tag. */
  sku: string
  styleName: string
  color: string
  size: string
  /** Units on the original invoice line. */
  quantitySold: number
  /** What one unit was actually paid, after any line discount. */
  unitPaid: number
  /** A discount applied across the whole sale, shared proportionally (rule 35). */
  saleDiscount: number
  /** Every line's paid value on that sale, before `saleDiscount`. */
  salePaidBeforeSaleDiscount: number
  /** How the sale was paid, so the refund can go back the same way (rule 48). */
  paidBy: RefundMethod
  invoiceReference: string
  soldAt: Date
}

/** Stand-in line: the API has no returns resource to read one from yet. */
export const SAMPLE_RETURNED_LINE: ReturnedLine = {
  sku: '8412-NVY-38',
  styleName: 'Linen wide-leg trouser',
  color: 'Navy',
  size: '38',
  quantitySold: 3,
  unitPaid: 64,
  saleDiscount: 0,
  salePaidBeforeSaleDiscount: 192,
  paidBy: 'cash',
  invoiceReference: 'INV-2026-0418',
  soldAt: new Date('2026-10-29T15:20:00'),
}

/**
 * Inspecting a return (BL-04 rules 31 to 37).
 *
 * What this screen deliberately does **not** do, because the rules say so:
 *
 * - It does not reduce the refund for condition. Rule 35 is the amount actually
 *   paid; the condition decides where the unit goes, not what it is worth.
 * - It does not offer a store-credit bonus. That was invented and is gone.
 * - It does not settle anything in one press. Rule 34 makes the return
 *   decision, the refund approval, the refund payment and the stock release four
 *   separate actions, none triggering another.
 *
 * Nothing is recorded: there is no returns endpoint, and no custody resource for
 * rule 32's separation of customer property from business stock.
 */
export function ReturnMerchandiseInspection({
  initialCondition = 'sellable',
  initialDecision = 'approve',
  line = SAMPLE_RETURNED_LINE,
  title = 'Return inspection',
  description = 'Record what came back and decide the return. The refund is what the customer paid; the condition decides where the unit goes.',
}: {
  initialCondition?: ReturnCondition
  initialDecision?: ReturnDecision
  line?: ReturnedLine
  title?: string
  description?: string
}) {
  const [condition, setCondition] = useState<ReturnCondition>(initialCondition)
  const [decision, setDecision] = useState<ReturnDecision>(initialDecision)
  const [units, setUnits] = useState(1)
  const [note, setNote] = useState('')
  const noteFieldId = useId()
  const reasonFieldId = useId()

  const conditionRule = returnConditionRule(condition)
  const decisionRule = returnDecisionRule(decision)
  const rejected = decision === 'reject'

  const settlement = useMemo(
    () =>
      settleReturn({
        unitPaid: line.unitPaid,
        units,
        saleDiscount: line.saleDiscount,
        salePaidBeforeSaleDiscount: line.salePaidBeforeSaleDiscount,
      }),
    [line.saleDiscount, line.salePaidBeforeSaleDiscount, line.unitPaid, units],
  )

  const unitChoices = useMemo(
    () => Array.from({ length: line.quantitySold }, (_, index) => index + 1),
    [line.quantitySold],
  )

  /* Rule 33: a rejection needs a manager reason before it can be recorded. */
  const reasonRequired = rejected
  const reasonMissing = reasonRequired && note.trim().length === 0

  return (
    <div className="stack rma-inspection">
      <PageHeader
        eyebrow="Returns"
        title={title}
        description={description}
        actions={
          <span className={`pill ${conditionRule.pillClass}`}>
            <span className="pill-dot" aria-hidden="true" />
            {conditionRule.label}
          </span>
        }
      />

      <p className="notice">
        <Info size={16} aria-hidden="true" />
        <span>
          <strong>Nothing is recorded yet.</strong> Returns have no backend resource and there is no
          custody record, so this screen works out a return on screen only. No stock moves, no refund
          is owed and no goods are taken into custody.
        </span>
      </p>

      <Panel
        title="Item under inspection"
        description={`Sold on ${line.invoiceReference}, ${formatShortDate(line.soldAt)}`}
      >
        <div className="panel-body">
          <dl className="detail-grid-fields">
            <div>
              <dt>SKU</dt>
              <dd className="tabular">{line.sku}</dd>
            </div>
            <div>
              <dt>Style</dt>
              <dd>{line.styleName}</dd>
            </div>
            <div>
              <dt>Colour / size</dt>
              <dd>
                {line.color} · {line.size}
              </dd>
            </div>
            <div>
              <dt>Paid per unit</dt>
              <dd className="tabular">{formatPrice(line.unitPaid)}</dd>
            </div>
            <div>
              <dt>Paid by</dt>
              <dd>{REFUND_METHOD_LABELS[line.paidBy]}</dd>
            </div>
          </dl>
        </div>
      </Panel>

      <Panel title="Units coming back" description={`Up to ${line.quantitySold} on the original line.`}>
        <div className="panel-body">
          <div className="chip-row" role="group" aria-label="Units coming back">
            {unitChoices.map((count) => (
              <button
                key={count}
                type="button"
                className="chip chip-lg rma-inspection__unit-chip"
                aria-pressed={count === units}
                onClick={() => setUnits(count)}
              >
                {count}
              </button>
            ))}
          </div>
          <p className="rma-inspection__hint muted">
            {units} of {line.quantitySold} units · {formatPrice(settlement.linePaid)} paid
          </p>
        </div>
      </Panel>

      <Panel
        title="Condition"
        description="Where the unit goes once the return is approved. It does not change the refund."
      >
        <div className="panel-body">
          <div className="chip-row" role="group" aria-label="Condition">
            {RETURN_CONDITIONS.map((rule) => (
              <button
                key={rule.value}
                type="button"
                className="chip chip-lg"
                aria-pressed={rule.value === condition}
                onClick={() => setCondition(rule.value)}
              >
                {rule.label}
              </button>
            ))}
          </div>
          <p className="rma-inspection__hint muted">{conditionRule.destination}</p>
        </div>
      </Panel>

      <Panel title="Decision" description="Approve or reject. Neither pays a refund or moves stock on its own.">
        <div className="panel-body">
          <div className="chip-row" role="group" aria-label="Return decision">
            {RETURN_DECISIONS.map((rule) => (
              <button
                key={rule.value}
                type="button"
                className="chip chip-lg"
                aria-pressed={rule.value === decision}
                onClick={() => setDecision(rule.value)}
              >
                {rule.label}
              </button>
            ))}
          </div>
          <p className="rma-inspection__hint muted">{decisionRule.hint}</p>
        </div>
      </Panel>

      <Panel title="Refund due">
        <div className="panel-body">
          <dl className="dl-grid rma-inspection__settlement">
            <dt>Paid for {units === 1 ? 'the unit' : `${units} units`}</dt>
            <dd className="tabular">{formatPrice(settlement.linePaid)}</dd>
            {settlement.discountShare > 0 && (
              <>
                <dt>Share of the sale discount</dt>
                <dd className="tabular">− {formatPrice(settlement.discountShare)}</dd>
              </>
            )}
            <dt className="rma-inspection__total-label">
              {rejected ? 'Nothing owed' : `Refund obligation · ${REFUND_METHOD_LABELS[line.paidBy]}`}
            </dt>
            <dd className="tabular rma-inspection__total">
              {formatPrice(rejected ? 0 : settlement.refundDue)}
            </dd>
          </dl>
          <p className="rma-inspection__hint muted">
            {rejected
              ? 'Rejected: the item is held for handback to the customer, no refund is owed and stock is untouched.'
              : `The refund is what was paid, and goes back through ${REFUND_METHOD_LABELS[line.paidBy]} — the method the sale was taken on. A different allocation needs a manager reason.`}
          </p>
        </div>
      </Panel>

      <Panel
        title="What still has to happen"
        description="Four separate actions. None of them triggers another."
      >
        <div className="panel-body">
          <ol className="rma-inspection__steps">
            {RETURN_ACTION_SEQUENCE.map((step) => (
              <li key={step.key}>
                <strong>{step.label}</strong>
                <span className="muted"> — {step.hint}</span>
              </li>
            ))}
          </ol>
        </div>
      </Panel>

      <Panel title="Inspector note" description={reasonRequired ? 'A rejection needs a reason.' : 'What the inspection found.'}>
        <div className="panel-body">
          <div className="field">
            <label htmlFor={rejected ? reasonFieldId : noteFieldId}>
              {rejected ? 'Why the return is rejected' : 'What the inspection found'}
            </label>
            <textarea
              id={rejected ? reasonFieldId : noteFieldId}
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={
                rejected ? 'Outside the return window and no manager exception.' : 'Pilling on the left seam, tags still attached.'
              }
            />
            {reasonMissing && <p className="field-error">Say why the return is rejected.</p>}
          </div>
          <div className="rma-inspection__actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled
              title="Returns have no API endpoint yet, so nothing can be recorded"
            >
              Record inspection
            </button>
            <p className="section-note">
              Condition, units and the refund due stay on this screen until a returns endpoint exists.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  )
}
