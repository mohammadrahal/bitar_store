import type { ApiTransfer, ApiTransferLine } from '@/lib/api/types'

function lineHasHoldShape(line: ApiTransferLine): boolean {
  return (
    typeof line.onHold === 'number' ||
    typeof line.releasedToSellable === 'number' ||
    typeof line.damaged === 'number'
  )
}

function normalizeLine(line: ApiTransferLine, apiHasHoldShape: boolean): ApiTransferLine {
  const damaged = line.damaged ?? 0
  let releasedToSellable = line.releasedToSellable ?? 0
  let onHold = line.onHold

  if (typeof onHold !== 'number') {
    if (apiHasHoldShape) {
      onHold = Math.max(0, line.received - damaged - releasedToSellable)
    } else {
      // Older API: received good units went directly to sellable.
      releasedToSellable = Math.max(0, line.received - damaged)
      onHold = 0
    }
  }

  return { ...line, damaged, releasedToSellable, onHold }
}

/** Ensures hold / release columns exist for UI and accept flow. */
export function normalizeTransfer(raw: ApiTransfer): ApiTransfer {
  const apiHasHoldShape = raw.lines.some(lineHasHoldShape) || typeof raw.totals?.onHold === 'number'
  const lines = raw.lines.map((line) => normalizeLine(line, apiHasHoldShape))
  const sum = (pick: (l: ApiTransferLine) => number) => lines.reduce((total, l) => total + pick(l), 0)

  return {
    ...raw,
    lines,
    totals: {
      ...raw.totals,
      damaged: raw.totals.damaged ?? sum((l) => l.damaged),
      releasedToSellable: raw.totals.releasedToSellable ?? sum((l) => l.releasedToSellable),
      onHold: raw.totals.onHold ?? sum((l) => l.onHold),
    },
  }
}
