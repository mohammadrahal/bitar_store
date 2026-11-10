import type { ApiTransfer, ApiTransferLine } from '@/lib/api/types'

/** Hold/release fields from the server, not legacy `damaged` (present before accept existed). */
function transferUsesHoldReleaseApi(raw: ApiTransfer): boolean {
  if (typeof raw.totals?.onHold === 'number' || typeof raw.totals?.releasedToSellable === 'number') {
    return true
  }
  return raw.lines.some(
    (line) => typeof line.onHold === 'number' || typeof line.releasedToSellable === 'number',
  )
}

function normalizeLine(line: ApiTransferLine, apiHasHoldShape: boolean): ApiTransferLine {
  const damaged = line.damaged ?? 0
  let releasedToSellable = line.releasedToSellable ?? 0
  let onHold = line.onHold

  if (apiHasHoldShape) {
    if (typeof onHold !== 'number') {
      onHold = Math.max(0, line.received - damaged - releasedToSellable)
    }
  } else {
    // Older API: good units landed on the sellable shelf at receive; no accept step.
    releasedToSellable = Math.max(0, line.received - damaged)
    onHold = 0
  }

  return { ...line, damaged, releasedToSellable, onHold }
}

/** Ensures hold / release columns exist for UI and accept flow. */
export function normalizeTransfer(raw: ApiTransfer): ApiTransfer {
  const apiHasHoldShape = transferUsesHoldReleaseApi(raw)
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
