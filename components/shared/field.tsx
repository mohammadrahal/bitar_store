import { cloneElement, isValidElement, useId, type ReactElement } from 'react'

export function Field({
  label,
  error,
  hint,
  className,
  icon,
  affix,
  children,
}: {
  label: string
  error?: string
  hint?: string
  className?: string
  /** Decorative icon at the start of the input. */
  icon?: React.ReactNode
  /** Control sitting inside the input, such as a password reveal toggle. */
  affix?: React.ReactNode
  children: ReactElement<Record<string, unknown>>
}) {
  const id = useId()
  const messageId = `${id}-message`
  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error || hint ? messageId : undefined,
      })
    : children

  return (
    <div className={`field ${className ?? ''}`}>
      <label htmlFor={id}>{label}</label>
      {affix || icon ? (
        <div className={`field-affix ${icon ? 'has-icon' : ''} ${affix ? 'has-affix' : ''}`}>
          {icon && (
            <span className="field-icon" aria-hidden="true">
              {icon}
            </span>
          )}
          {control}
          {affix}
        </div>
      ) : (
        control
      )}
      {(error || hint) && (
        <span id={messageId} className={error ? 'field-error' : 'field-hint'}>
          {error ?? hint}
        </span>
      )}
    </div>
  )
}
