import { AlertCircle } from 'lucide-react'

/** What the API said when it refused a write, next to the form it refused. */
export function FormAlert({ error }: { error: Error | null }) {
  if (!error) return null
  return (
    <p className="form-alert full" role="alert">
      <AlertCircle size={16} aria-hidden="true" />
      {error.message}
    </p>
  )
}
