'use client'

import { Ban, Trash2 } from 'lucide-react'
import { Can } from '@/components/shared/can'
import { isEditable, isPosted } from '@/lib/invoices'
import type { Invoice } from '@/types'

/** The two ways a document leaves play: void what was posted, delete what was not. */
export function InvoiceDangerZone({
  invoice,
  busy,
  onVoid,
  onDelete,
}: {
  invoice: Invoice
  busy: boolean
  onVoid: () => void
  onDelete: () => void
}) {
  if (isPosted(invoice)) {
    return (
      <Can permission="documents.void">
        <div className="doc-danger">
          <div>
            <p className="section-label">Void this document</p>
            <p className="field-hint">
              It stays on file and its units go back where they came from. Raise a return instead when the goods
              genuinely moved.
            </p>
          </div>
          <button type="button" className="btn btn-danger" onClick={onVoid} disabled={busy}>
            <Ban size={16} aria-hidden="true" />
            Void
          </button>
        </div>
      </Can>
    )
  }

  if (!isEditable(invoice)) return null

  return (
    <Can permission="documents.manage">
      <div className="doc-danger">
        <div>
          <p className="section-label">Delete this draft</p>
          <p className="field-hint">Nothing has been posted, so the draft can be removed outright.</p>
        </div>
        <button type="button" className="btn btn-danger" onClick={onDelete} disabled={busy}>
          <Trash2 size={16} aria-hidden="true" />
          Delete draft
        </button>
      </div>
    </Can>
  )
}
