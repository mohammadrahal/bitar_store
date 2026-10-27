import { z } from 'zod'

const priceField = z
  .number({ error: 'Enter an amount' })
  .min(0, 'Must be 0 or more')
  .max(1_000_000, 'That price looks too high')

const optionalText = (max: number) => z.string().trim().max(max, 'Too long')

const detailsShape = {
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120, 'Name is too long'),
  category: z.string().trim().min(2, 'Category must be at least 2 characters').max(60, 'Category is too long'),
  costPrice: priceField,
  sellPrice: priceField,
  season: optionalText(40),
  brand: optionalText(40),
  material: optionalText(80),
  description: optionalText(500),
}

function sellCoversCost(values: { costPrice: number; sellPrice: number }) {
  return values.costPrice === 0 || values.sellPrice >= values.costPrice
}
const sellCoversCostIssue = { message: 'Sell price must be at least the cost price', path: ['sellPrice'] }

/** Editing a model changes its details only; variants are added separately and never renamed. */
export const productDetailsSchema = z.object(detailsShape).refine(sellCoversCost, sellCoversCostIssue)

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
    /** Branches that will carry the model. Nothing is placed anywhere else. */
    branchIds: z.array(z.string()).min(1, 'Pick at least one branch to stock this model'),
    /** Opening units keyed by `branchId|color|size`; blank means zero. */
    opening: z.record(
      z.string(),
      z.number().int('Whole units only').min(0, 'Cannot be negative').max(100_000, 'That looks too high'),
    ),
    /** Per-variant sell prices keyed by `color|size`. Blank uses the default sell price. */
    prices: z.record(z.string(), priceField),
  })
  .refine(sellCoversCost, sellCoversCostIssue)
  .refine((values) => combinationsOf(values).length > 0, {
    message: 'Keep at least one color and size combination',
    path: ['excluded'],
  })
  .refine(
    (values) =>
      values.costPrice === 0 ||
      combinationsOf(values).every(({ color, size }) => (values.prices[comboKey(color, size)] ?? values.sellPrice) >= values.costPrice),
    { message: 'Each variant price must be at least the cost price', path: ['prices'] },
  )

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
  name: '',
  category: '',
  costPrice: 0,
  sellPrice: 0,
  season: '',
  brand: '',
  material: '',
  description: '',
  colors: [],
  sizeSystem: 'letter',
  sizes: [],
  excluded: [],
  branchIds: [],
  opening: {},
  prices: {},
}

export const openingKey = (branchId: string, color: string, size: string) => `${branchId}|${comboKey(color, size)}`

/** Blank optional fields are left off rather than saved as empty strings. */
export function detailsFrom(values: Pick<ProductDetailsFormValues, 'season' | 'brand' | 'material' | 'description'>) {
  const entries = Object.entries(values).filter(([, value]) => value.trim() !== '')
  return entries.length ? Object.fromEntries(entries) : undefined
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

export const colorSchema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(24, 'Too long'),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a color'),
})
