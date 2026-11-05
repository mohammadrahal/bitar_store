'use client'

import { useEffect } from 'react'

/**
 * The last resort: a failure in the root layout itself, which replaces the
 * whole document. Next does not load globals.css here and the theme class
 * never reaches it, so the brand palette is restated inline and both schemes
 * are handled with a media query rather than the app's own toggle.
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          background: '#F8F8F6',
          color: '#1B1A18',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          fontSize: 14,
          lineHeight: 1.5,
        }}
      >
        <title>Something went wrong · Bitar Fashion</title>
        <style>{`
          @media (prefers-color-scheme: dark) {
            body { background: #121110 !important; color: #F3EFE8 !important; }
            .ge-note { color: #A39C91 !important; }
            .ge-btn { background: #F3EFE8 !important; color: #121110 !important; }
          }
        `}</style>
        <main style={{ maxWidth: '44ch', textAlign: 'center' }}>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              fontWeight: 500,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              color: '#B08D57',
            }}
          >
            Bitar Fashion
          </p>
          <h1 style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 600, letterSpacing: '-.02em' }}>
            Something went wrong
          </h1>
          <p className="ge-note" style={{ margin: '8px 0 24px', color: '#6B655D' }}>
            The application could not start. Trying again often clears it; if it does not, reload the page.
          </p>
          <button
            type="button"
            className="ge-btn"
            onClick={() => retry()}
            style={{
              font: 'inherit',
              minHeight: 40,
              padding: '0 20px',
              border: 0,
              borderRadius: 6,
              background: '#1B1A18',
              color: '#F8F8F6',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
