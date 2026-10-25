import { z } from 'zod'

const priceField = z
  .number({ error: 'Enter an amount' })
  .min(0, 'Must be 0 or more')
  .max(1_000_000, 'That price looks too high')

export const variantSchema = z.object({
  /** Present for variants that already exist; absent for rows just added. */
  id: z.string().optional(),
  size: z.string().trim().min(1, 'Required').max(12, 'Too long'),
  color: z.string().trim().min(1, 'Required').max(24, 'Too long'),
})

export const productSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80, 'Name is too long'),
    category: z.string().trim().min(2, 'Category must be at least 2 characters').max(40, 'Category is too long'),
    costPrice: priceField,
    sellPrice: priceField,
    variants: z.array(variantSchema).min(1, 'Add at least one variant'),
  })
  .refine((values) => values.sellPrice >= values.costPrice, {
    message: 'Sell price must be at least the cost price',
    path: ['sellPrice'],
  })
  .superRefine((values, ctx) => {
    const seen = new Set<string>()
    values.variants.forEach((variant, index) => {
      const key = `${variant.size.toLowerCase()}|${variant.color.toLowerCase()}`
      if (seen.has(key)) {
        ctx.addIssue({
          code: 'custom',
          message: 'This size and color pair is already in the list',
          path: ['variants', index, 'color'],
        })
      }
      seen.add(key)
    })
  })

export type ProductFormValues = z.infer<typeof productSchema>
export type VariantFormValues = z.infer<typeof variantSchema>

export const emptyProductValues: ProductFormValues = {
  name: '',
  category: '',
  costPrice: 0,
  sellPrice: 0,
  variants: [{ size: '', color: '' }],
}
