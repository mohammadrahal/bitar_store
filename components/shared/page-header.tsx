import { FadeIn } from '@/components/motion/fade-in'

export function LocationEyebrow({ label, name }: { label: string; name: string }) {
  return (
    <p className="page-eyebrow-location">
      <span className="page-eyebrow-location-label">{label}</span>
      <span className="page-eyebrow-location-name">{name}</span>
    </p>
  )
}

/** Page title with the user’s first name in brand gold. */
export function WelcomeTitle({ name }: { name: string }) {
  return (
    <>
      Welcome back, <span className="welcome-name">{name}</span>
    </>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <FadeIn className="page-heading">
      <div>
        {eyebrow ? (
          typeof eyebrow === 'string' ? <p className="eyebrow">{eyebrow}</p> : eyebrow
        ) : null}
        <h1>{title}</h1>
        {description && <p className="subtitle">{description}</p>}
      </div>
      {actions && <div className="heading-actions">{actions}</div>}
    </FadeIn>
  )
}
