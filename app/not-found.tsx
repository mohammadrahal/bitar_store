import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="not-found">
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <p className="subtitle">The page you’re looking for doesn’t exist or has moved.</p>
      <Link href="/" className="btn btn-primary">
        Back to overview
      </Link>
    </div>
  )
}
