import { z } from 'zod'

const priceField = z
  .number({ error: 'Enter an amount' })
  .min(0, 'Must be 0 or more')
  .max(1_000_000, 'That price looks too high')

const detailsShape = {
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120, 'Name is too long'),
  category: z.string().trim().min(2, 'Category must be at least 2 characters').max(60, 'Category is too long'),
  sellPrice: priceField,
}

/**
 * Editing a model changes its name, category and price; variants are added
 * separately and never renamed. There is no cost: the API has none.
 */
export const productDetailsSchema = z.object(detailsShape)

export const newProductSchema = z
  .object({
    ...detailsShape,
    /** Blank lets the next free MD code be used. */
    code: z
      .string()
      .trim()
      .toUpperCase()
      .max(30, 'Keep the code to 30 characters so SKU codes fit')
      .regex(/^([A-Z0-9][A-Z0-9._/-]*)?$/, 'Letters, digits and . _ / - only, starting with a letter or digit'),
    colors: z.array(z.string()).min(1, 'Pick at least one color'),
    sizeSystem: z.enum(['letter', 'numeric', 'one']),
    sizes: z.array(z.string()).min(1, 'Pick at least one size'),
    /** `color|size` pairs switched off in the grid. */
    excluded: z.array(z.string()),
    /** Per-variant sell prices keyed by `color|size`. Blank uses the default sell price. */
    prices: z.record(z.string(), priceField),
    /** Where the first units are counted in. Blank places nothing. */
    openingBranchId: z.string(),
    /** Units per `color|size`, posted as opening stock once the SKUs exist. */
    openingQuantities: z.record(z.string(), z.number().int('Whole units only').min(0, 'Must be 0 or more')),
  })
  .refine((values) => combinationsOf(values).length > 0, {
    message: 'Keep at least one color and size combination',
    path: ['excluded'],
  })
  .superRefine((values, ctx) => {
    /* Counted units have to belong somewhere. */
    const counted = Object.values(values.openingQuantities).some((quantity) => quantity > 0)
    if (counted && !values.openingBranchId) {
      ctx.addIssue({ code: 'custom', message: 'Say where these units are', path: ['openingBranchId'] })
    }
  })

export type ProductDetailsFormValues = z.infer<typeof productDetailsSchema>
export type NewProductFormValues = z.infer<typeof newProductSchema>

export const comboKey = (color: string, size: string) => `${color}|${size}`

export function combinationsOf(values: {
  colors: string[]
  sizes: string[]
  excluded: string[]
}): { color: string; size: string }[] {
  const excluded = new Set(values.excluded)
  return values.colors.flatMap((color) =>
    values.sizes.filter((size) => !excluded.has(comboKey(color, size))).map((size) => ({ color, size })),
  )
}

export const emptyNewProductValues: NewProductFormValues = {
  code: '',
  openingBranchId: '',
  openingQuantities: {},
  name: '',
  category: '',
  sellPrice: 0,
  colors: [],
  sizeSystem: 'letter',
  sizes: [],
  excluded: [],
  prices: {},
}

/** A new price for one SKU. */
export const skuPriceSchema = z.object({ price: priceField })
export type SkuPriceFormValues = z.infer<typeof skuPriceSchema>

/** Barcodes are scanned, so anything printable goes except spaces. */
export const barcodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, 'Scan or type a barcode')
    .max(64, 'At most 64 characters')
    .regex(/^[\x21-\x7E]+$/, 'No spaces or special characters'),
})
export type BarcodeFormValues = z.infer<typeof barcodeSchema>

/** A colour is typed in on the model; the API stores it as a plain string. */
export const colorSchema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(24, 'Too long'),
})

/** A size typed in by hand, for models the letter/numeric lists do not cover. */
export const sizeNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter a size')
  .max(16, 'Too long')
  .regex(/^[A-Za-z0-9][A-Za-z0-9 ./-]*$/, 'Letters, digits and . / - only')
