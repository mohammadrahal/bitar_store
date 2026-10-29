import { getApiClient } from '@/lib/api'
import { writeDb } from '@/mocks/store'
import { syncCatalog } from '@/services/catalog-sync.service'

const PAGE = 200

async function fetchAllStyles() {
  const api = getApiClient()
  const styles = []
  for (let offset = 0; ; offset += PAGE) {
    const page = await api.listStyles({ limit: PAGE, offset, activeOnly: false })
    styles.push(...page)
    if (page.length < PAGE) return styles
  }
}

/** Drops mirrored catalog rows on this device (stock rows tied to variants go too). */
export function clearLocalCatalogMirror(): void {
  writeDb((db) => {
    db.products = []
    db.variants = []
    db.stock = db.stock.filter(() => false)
    db.catalogSynced = false
  })
}

export interface ArchiveAllResult {
  archived: number
  skipped: number
  errors: { code: string; name: string; message: string }[]
}

/**
 * Archives every active style on the server (the API keeps history; there is no
 * hard delete). Clears the local mirror so the next sync matches the server.
 */
export async function archiveAllActiveStyles(): Promise<ArchiveAllResult> {
  const api = getApiClient()
  const styles = await fetchAllStyles()
  const result: ArchiveAllResult = { archived: 0, skipped: 0, errors: [] }

  for (const style of styles) {
    if (!style.isActive) {
      result.skipped += 1
      continue
    }
    try {
      await api.updateStyle(style.id, { isActive: false })
      result.archived += 1
    } catch (error) {
      result.errors.push({
        code: style.code,
        name: style.name,
        message: error instanceof Error ? error.message : 'Could not archive',
      })
    }
  }

  clearLocalCatalogMirror()
  await syncCatalog()
  return result
}
