'use client'

import { Field } from '@/components/shared/field'
import { INVOICE_PAYMENT_LABELS, INVOICE_PAYMENT_METHODS } from '@/lib/invoices'
import type { InvoicePaymentMethod } from '@/types'

export function InvoicePaymentField({
  method,
  onMethodChange,
  reference,
  onReferenceChange,
  referenceError,
}: {
  method: InvoicePaymentMethod
  onMethodChange: (method: InvoicePaymentMethod) => void
  reference: string
  onReferenceChange: (value: string) => void
  referenceError?: string
}) {
  return (
    <>
      <fieldset className="field full">
        <legend>Payment</legend>
        <div className="segmented" role="radiogroup" aria-label="Payment method">
          {INVOICE_PAYMENT_METHODS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={method === option}
              className={method === option ? 'active' : ''}
              onClick={() => onMethodChange(option)}
            >
              {INVOICE_PAYMENT_LABELS[option]}
            </button>
          ))}
        </div>
      </fieldset>
      {method === 'whish' && (
        <Field
          label="Whish reference"
          error={referenceError}
          hint={referenceError ? undefined : 'The payment confirmation from Whish'}
          className="full"
        >
          <input
            value={reference}
            onChange={(event) => onReferenceChange(event.target.value)}
            autoComplete="off"
            placeholder="WH-12345"
            spellCheck={false}
          />
        </Field>
      )}
    </>
  )
}
