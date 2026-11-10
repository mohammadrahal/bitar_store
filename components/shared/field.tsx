import { Children, cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react'

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
  children: ReactNode
}) {
  const id = useId()
  const messageId = `${id}-message`
  const items = Children.toArray(children)
  const controlIndex = items.findIndex((child) => isValidElement(child))
  const controlChild = controlIndex >= 0 ? items[controlIndex] : null
  const extras = items.filter((_, index) => index !== controlIndex)
  const control = isValidElement(controlChild)
    ? cloneElement(controlChild as ReactElement<Record<string, unknown>>, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': error || hint ? messageId : undefined,
      })
    : controlChild

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
      {extras}
      {(error || hint) && (
        <span id={messageId} className={error ? 'field-error' : 'field-hint'}>
          {error ?? hint}
        </span>
      )}
    </div>
  )
}
