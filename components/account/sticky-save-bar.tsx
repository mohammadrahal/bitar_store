'use client'

import { Loader2 } from 'lucide-react'

export function StickySaveBar({
  visible,
  saving,
  saveDisabled,
  onDiscard,
  onSave,
}: {
  visible: boolean
  saving: boolean
  saveDisabled?: boolean
  onDiscard: () => void
  onSave: () => void
}) {
  if (!visible) return null
  return (
    <div className="settings-save-bar" role="status">
      <p>You have unsaved changes</p>
      <div className="settings-save-bar-actions">
        <button type="button" className="btn btn-secondary" onClick={onDiscard} disabled={saving}>
          Discard
        </button>
        <button type="button" className="btn btn-primary" onClick={onSave} disabled={saving || saveDisabled}>
          {saving ? (
            <>
              <Loader2 size={16} className="spin" aria-hidden="true" />
              Saving…
            </>
          ) : (
            'Save'
          )}
        </button>
      </div>
    </div>
  )
}
