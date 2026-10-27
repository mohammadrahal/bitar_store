'use client'

import { useState } from 'react'
import { ColorPicker } from '@/components/products/color-picker'
import { SizePicker } from '@/components/products/size-picker'
import { VariantGrid } from '@/components/products/variant-grid'
import { Drawer } from '@/components/shared/drawer'
import { useAddVariants } from '@/hooks/use-products'
import { compareSizes, sizeSystemOf } from '@/lib/sizes'
import { comboKey } from '@/schemas/product.schema'
import type { ProductWithVariants } from '@/types'

/** New colors and sizes in the model's own size system. Existing variants show ticked and locked. */
export function AddVariantsDrawer({ product, onClose }: { product: ProductWithVariants; onClose: () => void }) {
  const add = useAddVariants()
  const existingColors = [...new Set(product.variants.map((variant) => variant.color))]
  const existingSizes = [...new Set(product.variants.map((variant) => variant.size))]
  const existing = new Set(product.variants.map((variant) => comboKey(variant.color, variant.size)))
  const system = sizeSystemOf(existingSizes)

  const [colors, setColors] = useState<string[]>([])
  const [sizes, setSizes] = useState<string[]>([])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const allColors = [...existingColors, ...colors]
  const allSizes = [...new Set([...existingSizes, ...sizes])].sort(compareSizes)
  // New colors and sizes default to on; old×old gaps default to off.
  const isOn = (color: string, size: string) => {
    const key = comboKey(color, size)
    const fresh = colors.includes(color) || sizes.includes(size)
    return fresh ? !picked.has(key) : picked.has(key)
  }
  const combos = allColors.flatMap((color) =>
    allSizes.filter((size) => !existing.has(comboKey(color, size)) && isOn(color, size)).map((size) => ({ color, size })),
  )

  const submit = () => {
    if (combos.length === 0) {
      setError('Tick at least one new combination.')
      return
    }
    add.mutate({ productId: product.id, combos }, { onSuccess: onClose, onError: (failure: Error) => setError(failure.message) })
  }

  return (
    <Drawer
      eyebrow={product.code}
      title="Add variants"
      description="New variants start at zero stock everywhere. Existing variants are never renamed."
      onClose={onClose}
      onSubmit={submit}
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={add.isPending}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={add.isPending}>
            {add.isPending ? 'Saving…' : `Add ${combos.length} ${combos.length === 1 ? 'variant' : 'variants'}`}
          </button>
        </>
      }
    >
      <div className="drawer-section stack">
        <h3>Colors</h3>
        <ColorPicker value={colors} onChange={setColors} locked={existingColors} />
      </div>
      <div className="drawer-section stack">
        <h3>Sizes</h3>
        <SizePicker system={system} sizes={sizes} onSystemChange={() => undefined} onChange={setSizes} lockSystem locked={existingSizes} />
      </div>
      <div className="drawer-section stack">
        <h3>Combinations</h3>
        <VariantGrid
          colors={allColors}
          sizes={allSizes}
          isOn={isOn}
          isLocked={(color, size) => existing.has(comboKey(color, size))}
          onToggle={(color, size) => {
            const key = comboKey(color, size)
            setPicked((current) => {
              const next = new Set(current)
              if (next.has(key)) next.delete(key)
              else next.add(key)
              return next
            })
          }}
        />
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Drawer>
  )
}
