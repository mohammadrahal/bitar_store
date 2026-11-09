/*
 * The app shell, so a till that reopens without a network gets the app rather
 * than the browser's offline page. Data is not this worker's business: the
 * TanStack Query snapshot in IndexedDB holds that (see lib/query-persist.ts).
 *
 * Two rules only, because a cache that outsmarts itself is how a shop ends up
 * running last week's JavaScript against this week's API:
 *
 *   1. Build output under /_next/static/ is content-hashed, so it is immutable
 *      and served cache-first. A new deployment asks for new filenames.
 *   2. Documents and RSC payloads go to the network first and fall back to the
 *      last copy. Online that means no staleness at all; offline it means the
 *      shell still opens.
 *
 * Anything cross-origin is left alone — that includes the API, whose responses
 * carry a bearer token's worth of private data and must never land in a cache
 * the next user of the tablet could read.
 */

const VERSION = 'v1'
const SHELL = `bitar-shell-${VERSION}`
const STATIC = `bitar-static-${VERSION}`
const DOCUMENTS = `bitar-documents-${VERSION}`
const KEEP = new Set([SHELL, STATIC, DOCUMENTS])

/* Enough to boot: the start URL plus the icons the shell draws. The dashboard
   routes themselves are cached as they are visited. */
const SHELL_URLS = ['/', '/dashboard', '/icon.svg', '/bitar-logo.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      /* One miss (a route that 404s in this build) must not fail the install
         and leave the tablet with no worker at all. */
      .then((cache) => Promise.allSettled(SHELL_URLS.map((url) => cache.add(new Request(url, { cache: 'reload' })))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !KEEP.has(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

function isStaticAsset(url) {
  return url.pathname.startsWith('/_next/static/')
}

function isDocument(request) {
  if (request.mode === 'navigate') return true
  /* App Router navigations after the first one fetch an RSC payload rather
     than a document; they are the same thing as far as caching goes. */
  return request.headers.get('RSC') === '1' || new URL(request.url).searchParams.has('_rsc')
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request)
  if (hit) return hit
  const response = await fetch(request)
  if (response.ok) cache.put(request, response.clone())
  return response
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    /* Only a complete, public answer is worth keeping. A redirect to /login or
       a partial 206 replayed from cache would strand the shell. */
    if (response.ok && response.type === 'basic') cache.put(request, response.clone())
    return response
  } catch (error) {
    const hit = (await cache.match(request)) ?? (await caches.match('/dashboard')) ?? (await caches.match('/'))
    if (hit) return hit
    throw error
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  /* Never cache a signed-in read, and never serve one from a cache. */
  if (request.headers.has('Authorization')) return
  if (url.pathname.startsWith('/api/')) return

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, STATIC))
    return
  }
  if (isDocument(request)) {
    event.respondWith(networkFirst(request, DOCUMENTS))
  }
})
