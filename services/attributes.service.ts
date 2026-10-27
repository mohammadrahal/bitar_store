import { delay, delayedFailure } from '@/lib/delay'
import { readDb, writeDb } from '@/mocks/store'
import type { ColorOption } from '@/types'

export async function listColors(): Promise<ColorOption[]> {
  return delay(readDb().colors)
}

/** "black" is refused while "Black" exists, so the shared list never splits one color in two. */
export async function addColor(input: ColorOption): Promise<ColorOption> {
  const name = input.name.trim().replace(/\s+/g, ' ')
  const proper = name.charAt(0).toUpperCase() + name.slice(1)
  const existing = readDb().colors.find((color) => color.name.toLowerCase() === name.toLowerCase())
  if (existing) return delayedFailure(`${existing.name} already exists.`)
  const color = { name: proper, hex: input.hex }
  writeDb((db) => {
    db.colors.push(color)
  })
  return delay(color)
}
