import { FlaskConical } from 'lucide-react'

/**
 * Marks a screen that still runs on this browser's local ledger. The workflow
 * is real, the numbers are not shared: another device will not see them, and
 * they do not move server stock. One component so every such screen says the
 * same thing in the same place.
 */
export function PreviewBadge({ feature, className }: { feature: string; className?: string }) {
  return (
    <p className={`preview-badge ${className ?? ''}`} role="note">
      <FlaskConical size={14} aria-hidden="true" />
      <strong>Preview, not live</strong>
      <span>
        {feature} is kept on this device until the backend has an endpoint for it. Nothing here changes server stock.
      </span>
    </p>
  )
}
