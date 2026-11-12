import { NextResponse, type NextRequest } from 'next/server'

/**
 * Hub list views: `/inventory?section=…` and `/admin?section=…`.
 * Legacy top-level URLs redirect so bookmarks keep working. `/transfers` and
 * `/stock-receipts` are dedicated app routes — do not fold them into the inventory hub.
 *
 * Next 16 renamed the `middleware` file convention to `proxy` — same request
 * hook, same `config.matcher`, and the function must be named `proxy` (or be
 * the default export) for the file to be picked up at all. The matcher lists
 * the old paths only, so nothing else in the app pays for these redirects.
 */
export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  if (pathname === '/replenishment') {
    const url = request.nextUrl.clone()
    url.pathname = '/inventory'
    url.searchParams.set('section', 'replenishment')
    searchParams.forEach((value, key) => {
      if (key === 'section') return
      url.searchParams.set(key, value)
    })
    return NextResponse.redirect(url)
  }

  const adminHub = (section: string) => {
    const url = request.nextUrl.clone()
    url.pathname = '/admin'
    url.searchParams.set('section', section)
    searchParams.forEach((value, key) => {
      if (key === 'section') return
      url.searchParams.set(key, value)
    })
    return NextResponse.redirect(url)
  }

  if (pathname === '/users') return adminHub('users')
  if (pathname === '/branches') return adminHub('locations')
  if (pathname === '/opening-stock') return adminHub('opening-stock')
  if (pathname === '/reports') return adminHub('reports')
  if (pathname === '/audit') return adminHub('audit')
  if (pathname === '/settings' || pathname === '/settings/exchange') return adminHub('settings')

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/replenishment',
    '/users',
    '/branches',
    '/opening-stock',
    '/reports',
    '/audit',
    '/settings',
    '/settings/exchange',
  ],
}
