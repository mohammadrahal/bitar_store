'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { InvoiceLineFields } from '@/components/invoices/invoice-line-fields'
import { InvoiceSummary } from '@/components/invoices/invoice-summary'
import { Can } from '@/components/shared/can'
import { Drawer } from '@/components/shared/drawer'
import { Field } from '@/components/shared/field'
import { useBranches } from '@/hooks/use-branches'
import { useCreateInvoice, useUpdateInvoice } from '@/hooks/use-invoices'
import { usePermission } from '@/hooks/use-permission'
import { toDateInput } from '@/lib/format'
import { invoiceTotals } from '@/lib/invoice-totals'
import { INVOICE_KIND_LABELS, INVOICE_KINDS, PARTY_LABELS, pricedAtCost } from '@/lib/invoices'
import { emptyInvoiceValues, invoiceSchema, type InvoiceFormValues } from '@/schemas/invoice.schema'
import type { InvoiceWithLines, SalesChannel, VariantOption } from '@/types'

function toFormValues(
  defaultBranchId: string,
  invoice?: InvoiceWithLines,
  salesChannel?: SalesChannel,
): InvoiceFormValues {
  if (!invoice) return emptyInvoiceValues(defaultBranchId, salesChannel)
  return {
    kind: invoice.kind,
    branchId: invoice.branchId,
    partyName: invoice.partyName,
    issuedAt: toDateInput(new Date(invoice.issuedAt)),
    discount: invoice.discount,
    notes: invoice.notes ?? '',
    salesChannel: invoice.salesChannel,
    lines: invoice.lines.map((line) => ({
      id: line.id,
      variantId: line.variantId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    })),
  }
}

/** Saved lines carry their own snapshot, which is enough to label them again. */
function knownVariantsOf(invoice?: InvoiceWithLines): VariantOption[] {
  if (!invoice) return []
  return invoice.lines.map((line) => ({
    variantId: line.variantId,
    sku: line.sku,
    productId: '',
    productName: line.productName,
    size: line.size,
    color: line.color,
    costPrice: line.unitCost,
    sellPrice: line.unitPrice,
  }))
}

/** Used for both create and edit; `invoice` decides which. Drafts only on edit. */
const SALE_DRAWER_COPY: Record<SalesChannel, { eyebrow: string; title: string }> = {
  b2b: { eyebrow: 'B2B sales', title: 'New wholesale sale' },
  b2c: { eyebrow: 'B2C sales', title: 'New retail sale' },
}

/** Used for both create and edit; `invoice` decides which. Drafts only on edit. */
export function InvoiceForm({
  invoice,
  defaultBranchId,
  onClose,
  salesChannel,
  saleOnly = false,
}: {
  invoice?: InvoiceWithLines
  defaultBranchId: string
  onClose: () => void
  /** Tags new customer sales for the B2B or B2C ledger. */
  salesChannel?: SalesChannel
  /** Locks the form to a customer sale (no purchases or returns). */
  saleOnly?: boolean
}) {
  const create = useCreateInvoice()
  const update = useUpdateInvoice()
  const { can } = usePermission()
  const { data: branches } = useBranches()
  const pending = create.isPending || update.isPending

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: toFormValues(defaultBranchId, invoice, salesChannel),
  })

  const kind = saleOnly ? 'sale' : watch('kind')
  const branchId = watch('branchId')
  const lines = watch('lines')
  const discount = watch('discount')
  const totals = invoiceTotals(lines ?? [], Number.isFinite(discount) ? discount : 0)

  // Switching kind would leave sell prices on a purchase, so it locks once lines exist.
  const kindLocked = (lines?.length ?? 0) > 0
  const kinds = INVOICE_KINDS.filter((option) => can('purchases:manage') || !pricedAtCost(option))
  const lockedChannel = salesChannel ?? invoice?.salesChannel
  const saleDrawer = saleOnly && lockedChannel ? SALE_DRAWER_COPY[lockedChannel] : null

  const save = (issue: boolean) =>
    handleSubmit((values) => {
      const kind = saleOnly ? 'sale' : values.kind
      const channel = saleOnly ? lockedChannel : values.salesChannel
      const input = {
        ...values,
        kind,
        notes: values.notes || undefined,
        salesChannel: kind === 'sale' || kind === 'sale_return' ? (channel ?? 'b2c') : undefined,
      }
      if (invoice) update.mutate({ invoiceId: invoice.id, input }, { onSuccess: onClose })
      else create.mutate({ input, issue }, { onSuccess: onClose })
    })

  return (
    <Drawer
      eyebrow={saleDrawer?.eyebrow ?? 'Invoices'}
      title={invoice ? `Edit ${invoice.number}` : (saleDrawer?.title ?? 'New invoice')}
      description={
        invoice
          ? 'Only drafts can be edited. Issuing applies the lines to branch stock.'
          : saleOnly
            ? 'A draft holds no stock. Issuing removes the sold units from branch inventory.'
            : 'A draft holds no stock. Issuing moves the lines in or out of the branch.'
      }
      onClose={onClose}
      onSubmit={save(false)}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={pending}>
            Cancel
          </button>
          <button type="submit" className="btn btn-secondary" disabled={pending}>
            {pending ? 'Saving…' : invoice ? 'Save draft' : 'Save as draft'}
          </button>
          {!invoice && (
            <Can action="invoices:issue">
              <button type="button" className="btn btn-primary" onClick={save(true)} disabled={pending}>
                {pending ? 'Saving…' : 'Save and issue'}
              </button>
            </Can>
          )}
        </>
      }
    >
      <div className="form-grid">
        {!saleOnly && (
          <Field
            label="Kind"
            error={errors.kind?.message}
            hint={kindLocked ? 'Remove the lines to change the kind' : undefined}
          >
            <select {...register('kind')} disabled={kindLocked}>
              {kinds.map((option) => (
                <option key={option} value={option}>
                  {INVOICE_KIND_LABELS[option]}
                </option>
              ))}
            </select>
          </Field>
        )}
        {lockedChannel ? <input type="hidden" {...register('salesChannel')} value={lockedChannel} /> : null}
        <Field label="Branch" error={errors.branchId?.message}>
          <select {...register('branchId')} disabled={branches?.length === 1}>
            {branches?.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
                {branch.isMain ? ' · Main' : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label={PARTY_LABELS[kind]} error={errors.partyName?.message} className="full">
          <input
            {...register('partyName')}
            autoComplete="off"
            placeholder={lockedChannel === 'b2b' ? 'Account or business name' : 'Walk-in customer'}
          />
        </Field>
        <Field label="Date" error={errors.issuedAt?.message}>
          <input {...register('issuedAt')} type="date" />
        </Field>
        <Field label="Discount" error={errors.discount?.message} hint="Taken off the subtotal">
          <input {...register('discount', { valueAsNumber: true })} type="number" min="0" step="0.01" inputMode="decimal" />
        </Field>
        <Field label="Notes" error={errors.notes?.message} hint="Optional" className="full">
          <textarea {...register('notes')} rows={2} placeholder="Anything worth remembering about this document" />
        </Field>
      </div>

      <InvoiceLineFields
        control={control}
        register={register}
        watch={watch}
        errors={errors}
        kind={kind}
        branchId={branchId}
        knownVariants={knownVariantsOf(invoice)}
      />

      <InvoiceSummary totals={totals} showMargin={false} />
    </Drawer>
  )
}
