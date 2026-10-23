'use client'

import { useId, useRef } from 'react'
import { X } from 'lucide-react'
import { useModalBehavior } from '@/hooks/use-modal-behavior'

interface DrawerProps {
  eyebrow: string
  title: string
  description?: string
  onClose: () => void
  children: React.ReactNode
  footer: React.ReactNode
  /** Wraps body and footer in a form so Enter submits. */
  onSubmit?: () => void
}

export function Drawer({ eyebrow, title, description, onClose, children, footer, onSubmit }: DrawerProps) {
  const ref = useRef<HTMLElement>(null)
  const titleId = useId()
  useModalBehavior(ref, onClose)

  const body = (
    <>
      <div className="drawer-body">{children}</div>
      <div className="drawer-actions">{footer}</div>
    </>
  )

  return (
    <div className="overlay overlay-drawer">
      <div className="overlay-backdrop" onClick={onClose} aria-hidden="true" />
      <aside ref={ref} className="drawer" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="drawer-header">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2 id={titleId}>{title}</h2>
            {description && <p className="drawer-copy">{description}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        {onSubmit ? (
          <form
            className="drawer-form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              onSubmit()
            }}
          >
            {body}
          </form>
        ) : (
          body
        )}
      </aside>
    </div>
  )
}
