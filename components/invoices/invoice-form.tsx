'use client'

import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { InvoiceLineFields } from '@/components/invoices/invoice-line-fields'
import { InvoiceSummary } from '@/components/invoices/invoice-summary'
import { Can } from '@/components/shared/can'
import { Drawer } from '@/components/shared/drawer'
import { Field } from '@/components/shared/field'
import { SelectInput } from '@/components/shared/select-input'
import { useBranches } from '@/hooks/use-branches'
import { useIdempotencyKey } from '@/hooks/use-idempotency-key'
import { useCreateInvoice, useUpdateInvoice } from '@/hooks/use-invoices'
import { usePermission } from '@/hooks/use-permission'
import { toDateInput } from '@/lib/format'
import { invoiceTotals } from '@/lib/invoice-totals'
import {
  INVOICE_KIND_LABELS,
  INVOICE_KINDS,
  isAdjustmentKind,
  PARTY_LABELS,
  pricedAtCost,
} from '@/lib/invoices'
import { emptyInvoiceValues, invoiceSchema, type InvoiceFormValues } from '@/schemas/invoice.schema'
import type { InvoiceKind, InvoiceWithLines, SalesChannel, VariantOption } from '@/types'

export interface InvoicePrefill {
  kind: InvoiceKind
  variant: VariantOption
}

function toFormValues(
  defaultBranchId: string,
  invoice?: InvoiceWithLines,
  salesChannel?: SalesChannel,
  prefill?: InvoicePrefill,
): InvoiceFormValues {
  if (!invoice && prefill) {
    return {
      ...emptyInvoiceValues(defaultBranchId),
      kind: prefill.kind,
      lines: [
        {
          variantId: prefill.variant.variantId,
          quantity: 1,
          unitPrice: pricedAtCost(prefill.kind)
            ? prefill.variant.costPrice
            : prefill.variant.sellPrice,
        },
      ],
    }
  }
  if (!invoice) return emptyInvoiceValues(defaultBranchId, salesChannel)
  return {
    kind: invoice.kind,
    branchId: invoice.branchId,
    partyName: invoice.partyName,
    reason: invoice.reason ?? '',
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
    /* Saved lines snapshot the SKU but not the barcode, and the label does
       not need it — only the catalog search does. */
    barcode: '',
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
  lockBranch = false,
  prefill,
}: {
  invoice?: InvoiceWithLines
  defaultBranchId: string
  onClose: () => void
  /** Opens the drawer on one variant already on a line, for a quick correction. */
  prefill?: InvoicePrefill
  /** Tags new customer sales for the B2B or B2C ledger. */
  salesChannel?: SalesChannel
  /** Locks the form to a customer sale (no purchases or returns). */
  saleOnly?: boolean
  /** Keeps the document on `defaultBranchId`, e.g. B2B sales from the warehouse only. */
  lockBranch?: boolean
}) {
  const create = useCreateInvoice()
  const idempotency = useIdempotencyKey()
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
    defaultValues: toFormValues(defaultBranchId, invoice, salesChannel, prefill),
  })

  const kind = saleOnly ? 'sale' : watch('kind')
  const branchId = watch('branchId')
  const lines = watch('lines')
  const discount = watch('discount')
  const totals = invoiceTotals(lines ?? [], Number.isFinite(discount) ? discount : 0)

  // Switching kind would leave sell prices on a purchase, so it locks once lines exist.
  const kindLocked = (lines?.length ?? 0) > 0
  const kinds = INVOICE_KINDS.filter((option) => can('documents.manage') || !pricedAtCost(option))
  const isAdjustment = isAdjustmentKind(kind)
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
      else
        create.mutate(
          { input, issue, key: idempotency.current() },
          {
            onSuccess: () => {
              idempotency.reset()
              onClose()
            },
          },
        )
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
            <Can permission="documents.manage">
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
          /* Controller wraps Field, not the other way round, so Field still
             clones the id and aria props straight onto the trigger. */
          <Controller
            control={control}
            name="kind"
            render={({ field }) => (
              <Field
                label="Kind"
                error={errors.kind?.message}
                hint={kindLocked ? 'Remove the lines to change the kind' : undefined}
              >
                <SelectInput
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={kindLocked}
                  options={kinds.map((option) => ({
                    value: option,
                    label: INVOICE_KIND_LABELS[option],
                  }))}
                />
              </Field>
            )}
          />
        )}
        {lockedChannel ? <input type="hidden" {...register('salesChannel')} value={lockedChannel} /> : null}
        <Controller
          control={control}
          name="branchId"
          render={({ field }) => (
            <Field
              label="Branch"
              error={errors.branchId?.message}
              hint={lockBranch ? 'Wholesale orders ship from the main warehouse only' : undefined}
            >
              <SelectInput
                value={field.value}
                onValueChange={field.onChange}
                disabled={lockBranch || branches?.length === 1}
                placeholder="Select a branch"
                options={
                  branches?.map((branch) => ({
                    value: branch.id,
                    label: branch.name,
                  })) ?? []
                }
              />
            </Field>
          )}
        />
        {isAdjustment ? (
          <Field
            label="Reason"
            error={errors.reason?.message}
            hint="Kept on the document, so the correction can be explained later"
            className="full"
          >
            <input
              {...register('reason')}
              autoComplete="off"
              placeholder="Stock count, damaged, theft, opening balance…"
            />
          </Field>
        ) : (
          <Field label={PARTY_LABELS[kind]} error={errors.partyName?.message} className="full">
            <input
              {...register('partyName')}
              autoComplete="off"
              placeholder={
                lockedChannel === 'b2b' ? 'Account or business name' : 'Walk-in customer'
              }
            />
          </Field>
        )}
        <Field label="Date" error={errors.issuedAt?.message}>
          <input {...register('issuedAt')} type="date" />
        </Field>
        {isAdjustment ? (
          /* A correction has no money side, so the discount is kept at its
             registered default rather than shown. */
          <input {...register('discount', { valueAsNumber: true })} type="hidden" />
        ) : (
          <Field label="Discount" error={errors.discount?.message} hint="Taken off the subtotal">
            <input {...register('discount', { valueAsNumber: true })} type="number" min="0" step="0.01" inputMode="decimal" />
          </Field>
        )}
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
        /* The prefilled variant labels its own line before any search runs. */
        knownVariants={prefill ? [prefill.variant] : knownVariantsOf(invoice)}
      />

      <InvoiceSummary totals={totals} showMargin={false} />
    </Drawer>
  )
}
