'use client'

import { useEffect } from 'react'

/**
 * Registers public/sw.js, which caches the app shell so the tablet can open
 * the app with no network. Development is left alone: a worker holding onto
 * chunk files across rebuilds produces failures that look like code bugs.
 *
 * `updateViaCache: 'none'` keeps the browser from serving the worker itself
 * from its HTTP cache, which is what makes a deployment take effect on the
 * next launch rather than whenever the old copy happens to expire.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    const register = () => {
      void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
        /* An unsupported or blocked worker costs the offline shell, nothing else. */
      })
    }
    /* Registering during load competes with the first screen's own requests. */
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
    return () => window.removeEventListener('load', register)
  }, [])

  return null
}
