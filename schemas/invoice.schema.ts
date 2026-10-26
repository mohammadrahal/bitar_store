import { z } from 'zod'
import { INVOICE_KINDS, isAdjustmentKind } from '@/lib/invoices'
import { todayAsDateInput } from '@/lib/format'

export const invoiceLineSchema = z.object({
  /** Present for lines that already exist; absent for rows just added. */
  id: z.string().optional(),
  variantId: z.string().min(1, 'Pick a variant'),
  quantity: z
    .number({ error: 'Enter a quantity' })
    .int('Whole units only')
    .min(1, 'At least 1')
    .max(9_999, 'That quantity looks too high'),
  unitPrice: z
    .number({ error: 'Enter a price' })
    .min(0, 'Must be 0 or more')
    .max(1_000_000, 'That price looks too high'),
})

export const invoiceSchema = z
  .object({
    kind: z.enum(INVOICE_KINDS),
    branchId: z.string().min(1, 'Pick a branch'),
    partyName: z.string().trim().max(80, 'Name is too long'),
    reason: z.string().trim().max(120, 'Reason is too long'),
    issuedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
    discount: z.number({ error: 'Enter an amount' }).min(0, 'Must be 0 or more'),
    notes: z.string().trim().max(400, 'Notes are too long'),
    salesChannel: z.enum(['b2b', 'b2c']).optional(),
    lines: z.array(invoiceLineSchema).min(1, 'Add at least one line'),
  })
  .superRefine((values, ctx) => {
    /* A trade document needs a counterparty; a correction needs a reason. */
    if (isAdjustmentKind(values.kind)) {
      if (values.reason.length < 2) {
        ctx.addIssue({ code: 'custom', message: 'Say why stock is being corrected', path: ['reason'] })
      }
    } else if (values.partyName.length < 2) {
      ctx.addIssue({ code: 'custom', message: 'Name must be at least 2 characters', path: ['partyName'] })
    }

    const seen = new Map<string, number>()
    values.lines.forEach((line, index) => {
      const first = seen.get(line.variantId)
      if (line.variantId && first !== undefined) {
        ctx.addIssue({
          code: 'custom',
          message: `Already on line ${first + 1}. Change the quantity there instead.`,
          path: ['lines', index, 'variantId'],
        })
      }
      seen.set(line.variantId, index)
    })

    const subtotal = values.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
    if (values.discount > subtotal) {
      ctx.addIssue({
        code: 'custom',
        message: 'A discount cannot be more than the subtotal',
        path: ['discount'],
      })
    }
  })

export type InvoiceFormValues = z.infer<typeof invoiceSchema>
export type InvoiceLineFormValues = z.infer<typeof invoiceLineSchema>

export function emptyInvoiceValues(branchId: string, salesChannel?: 'b2b' | 'b2c'): InvoiceFormValues {
  return {
    kind: 'sale',
    branchId,
    partyName: '',
    reason: '',
    issuedAt: todayAsDateInput(),
    discount: 0,
    notes: '',
    salesChannel,
    lines: [],
  }
}
