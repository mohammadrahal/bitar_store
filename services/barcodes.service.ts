import { ApiError, getApiClient } from '@/lib/api'
import { mapApiBarcode } from '@/lib/api/map-catalog'
import { randomEan13 } from '@/lib/barcode'
import type { Barcode } from '@/types'

const ATTEMPTS = 3

/** Gives a SKU its own in-store EAN-13, trying a new number if one is already taken. */
export async function mintBarcode(skuId: string): Promise<Barcode> {
  const api = getApiClient()
  for (let attempt = 1; ; attempt += 1) {
    try {
      return mapApiBarcode(await api.addBarcode(skuId, randomEan13()))
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 409) || attempt === ATTEMPTS) throw error
    }
  }
}
